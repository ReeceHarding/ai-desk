import { Database } from '@/types/supabase';
import { logger } from '@/utils/logger';
import { generateEmbedding, splitIntoChunks, upsertToPinecone } from '@/utils/rag';
import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';
import { NextApiRequest, NextApiResponse } from 'next';
import pdf from 'pdf-parse';

// Disable body parsing, we'll handle it with formidable
export const config = {
  api: {
    bodyParser: false,
  },
};

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse form data with proper configuration
    const form = formidable({
      multiples: false, // We handle one file at a time
      maxFileSize: 50 * 1024 * 1024, // 50MB max
      filter: (part): boolean => {
        return part.name === 'file' && !!(
          part.mimetype?.includes('application/pdf') ||
          part.mimetype?.includes('text/plain')
        );
      },
    });

    // Parse the form
    const [fields, files] = await new Promise<[formidable.Fields<string>, formidable.Files]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve([fields, files]);
      });
    });

    // Validate organization ID
    const orgId = Array.isArray(fields.orgId) ? fields.orgId[0] : fields.orgId;
    if (!orgId) {
      return res.status(400).json({ error: 'Missing organization ID' });
    }

    logger.info('Processing upload with organization ID', { orgId });

    // Get file
    const fileField = files.file;
    if (!fileField) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const uploadedFile = Array.isArray(fileField) ? fileField[0] : fileField;
    if (!uploadedFile) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filepath = uploadedFile.filepath;
    const mimetype = uploadedFile.mimetype || 'application/octet-stream';

    logger.info('Processing uploaded file', { 
      orgId, 
      filename: uploadedFile.originalFilename,
      mimetype,
      size: uploadedFile.size 
    });

    // Create knowledge_docs record
    const docTitle = uploadedFile.originalFilename || `Doc ${Date.now()}`;
    const { data: doc, error: docError } = await supabase
      .from('knowledge_docs')
      .insert({
        org_id: orgId,
        title: docTitle,
        metadata: {
          original_filename: uploadedFile.originalFilename,
          mimetype,
          size: uploadedFile.size,
        },
      })
      .select()
      .single();

    if (docError || !doc) {
      logger.error('Failed to create knowledge_docs record', { docError });
      return res.status(500).json({ error: 'Failed to save document record' });
    }

    // Verify the document was created with correct orgId
    if (doc.org_id !== orgId) {
      logger.error('Document created with incorrect orgId', { 
        expectedOrgId: orgId,
        actualOrgId: doc.org_id,
        docId: doc.id
      });
      await supabase.from('knowledge_docs').delete().eq('id', doc.id);
      return res.status(500).json({ error: 'Failed to save document with correct organization' });
    }

    // Extract text from file
    let textContent = '';
    try {
      if (mimetype === 'application/pdf') {
        const dataBuffer = fs.readFileSync(filepath);
        const pdfData = await pdf(dataBuffer);
        textContent = pdfData.text;
      } else if (mimetype.startsWith('text/')) {
        textContent = fs.readFileSync(filepath, 'utf8');
      } else {
        throw new Error('Unsupported file type');
      }
    } catch (error) {
      logger.error('Failed to extract text from file', { error, docId: doc.id });
      await supabase.from('knowledge_docs').delete().eq('id', doc.id);
      return res.status(400).json({ error: 'Failed to process file content' });
    }

    // Split content into chunks and generate embeddings
    const chunks = splitIntoChunks(textContent, 1000, 200);
    logger.info('Split document into chunks', { docId: doc.id, chunkCount: chunks.length });

    const pineconeRecords = await Promise.all(
      chunks.map(async (chunk, index) => {
        try {
          const embedding = await generateEmbedding(chunk);
          const metadata = {
            text: chunk,
            docId: doc.id,
            chunkIndex: index,
            orgId: orgId
          };
          
          logger.info('Creating Pinecone record', {
            docId: doc.id,
            chunkIndex: index,
            metadata,
            orgIdFromMetadata: metadata.orgId
          });
          
          return {
            id: `${doc.id}_${index}`,
            values: embedding,
            metadata
          };
        } catch (error) {
          logger.error('Failed to generate embedding for chunk', { 
            error, 
            docId: doc.id, 
            chunkIndex: index 
          });
          return null;
        }
      })
    );

    // Filter out failed embeddings
    const validRecords = pineconeRecords.filter((record): record is NonNullable<typeof record> => record !== null);

    if (validRecords.length === 0) {
      logger.error('No valid embeddings generated', { docId: doc.id });
      await supabase.from('knowledge_docs').delete().eq('id', doc.id);
      return res.status(500).json({ error: 'Failed to process document content' });
    }

    // Upsert to Pinecone
    try {
      await upsertToPinecone(validRecords);
      logger.info('Upserted chunks to Pinecone', { 
        docId: doc.id,
        totalChunks: validRecords.length,
        failedChunks: chunks.length - validRecords.length
      });
    } catch (error) {
      logger.error('Failed to upsert to Pinecone', { error, docId: doc.id });
      await supabase.from('knowledge_docs').delete().eq('id', doc.id);
      return res.status(500).json({ error: 'Failed to store document embeddings' });
    }

    // Cleanup
    try {
      fs.unlinkSync(filepath);
    } catch (error) {
      logger.warn('Failed to cleanup temporary file', { error, filepath });
    }

    return res.status(200).json({
      success: true,
      docId: doc.id,
      totalChunks: validRecords.length,
      failedChunks: chunks.length - validRecords.length,
    });
  } catch (error) {
    logger.error('Unexpected error in upload handler', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
} 