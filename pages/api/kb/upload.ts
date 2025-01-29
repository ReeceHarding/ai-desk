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
      multiples: false,
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

    logger.info('KB Upload started', { orgId, filename: uploadedFile.originalFilename, mimetype });

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
        },
      })
      .select()
      .single();

    if (docError || !doc) {
      logger.error('Failed to create knowledge_docs record', { docError });
      return res.status(500).json({ error: 'Failed to save document record' });
    }

    // Extract text from file
    let textContent = '';
    if (mimetype === 'application/pdf') {
      const dataBuffer = fs.readFileSync(filepath);
      const pdfData = await pdf(dataBuffer);
      textContent = pdfData.text;
    } else if (mimetype.startsWith('text/')) {
      textContent = fs.readFileSync(filepath, 'utf8');
    } else {
      logger.warn('Unsupported file type', { mimetype });
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    // Split into chunks
    const chunks = splitIntoChunks(textContent, 1000, 200);
    logger.info('Split document into chunks', { totalChunks: chunks.length, docId: doc.id });

    // Process each chunk
    const pineconeRecords = [];
    let chunkIndex = 0;

    for (const chunkText of chunks) {
      // Generate embedding
      const embedding = await generateEmbedding(chunkText);

      // Insert into knowledge_doc_chunks
      const { error: chunkError } = await supabase
        .from('knowledge_doc_chunks')
        .insert({
          doc_id: doc.id,
          chunk_index: chunkIndex,
          chunk_content: chunkText,
          embedding,
          token_length: Math.ceil(chunkText.split(/\s+/).length * 1.3),
          metadata: {
            orgId,
            docId: doc.id,
            chunkIndex,
          },
        });

      if (chunkError) {
        logger.error('Failed to insert chunk', { chunkError, chunkIndex });
        continue;
      }

      // Prepare for Pinecone
      pineconeRecords.push({
        id: `${doc.id}_${chunkIndex}`,
        values: embedding,
        metadata: {
          orgId,
          docId: doc.id,
          chunkIndex,
          text: chunkText,
        },
      });

      chunkIndex++;
    }

    // Upsert to Pinecone
    if (pineconeRecords.length > 0) {
      await upsertToPinecone(pineconeRecords);
      logger.info('Upserted chunks to Pinecone', { count: pineconeRecords.length });
    }

    // Cleanup
    fs.unlinkSync(filepath);

    return res.status(200).json({
      success: true,
      docId: doc.id,
      totalChunks: chunkIndex,
    });
  } catch (error) {
    logger.error('KB Upload error', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
} 