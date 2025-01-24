import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';
import { NextApiRequest, NextApiResponse } from 'next';
import pdf from 'pdf-parse';
import { logger } from '../../../utils/logger';
import { generateEmbedding, splitIntoChunks, upsertToPinecone } from '../../../utils/rag';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Disable the default body parser
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse the multipart form data
    const form = formidable({});
    const [fields, files] = await form.parse(req);
    
    if (!fields.orgId?.[0] || fields.orgId[0] === 'null') {
      logger.error('Invalid organization ID provided:', { orgId: fields.orgId?.[0] });
      return res.status(400).json({ error: 'Valid organization ID is required' });
    }

    const orgId = fields.orgId[0];
    
    // Verify organization exists
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      logger.error('Organization not found:', { orgId, error: orgError?.message });
      return res.status(404).json({ error: 'Organization not found' });
    }

    const uploadedFile = files.file?.[0];

    if (!uploadedFile) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Read the file content
    const fileBuffer = fs.readFileSync(uploadedFile.filepath);
    let textContent: string;

    // Parse based on file type
    if (uploadedFile.mimetype === 'application/pdf') {
      const pdfData = await pdf(fileBuffer);
      textContent = pdfData.text;
    } else if (uploadedFile.mimetype === 'text/plain') {
      textContent = fileBuffer.toString('utf-8');
    } else {
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    // Insert document record
    const { data: docData, error: docError } = await supabase
      .from('knowledge_docs')
      .insert({
        org_id: orgId,
        title: uploadedFile.originalFilename || 'Untitled Document',
        metadata: {
          mime_type: uploadedFile.mimetype,
          size: uploadedFile.size,
        },
      })
      .select()
      .single();

    if (docError) {
      logger.error('Failed to insert document record:', { error: docError.message });
      return res.status(500).json({ error: 'Failed to save document' });
    }

    if (!docData) {
      logger.error('No document data returned after insert');
      return res.status(500).json({ error: 'Failed to save document' });
    }

    // Split content into chunks
    const chunks = splitIntoChunks(textContent);
    
    // Process chunks in batches to avoid rate limits
    const BATCH_SIZE = 20;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batchChunks = chunks.slice(i, i + BATCH_SIZE);
      
      // Generate embeddings for the batch
      const embeddingPromises = batchChunks.map(chunk => generateEmbedding(chunk));
      const embeddings = await Promise.all(embeddingPromises);

      // Prepare records for database and Pinecone
      const chunkRecords = batchChunks.map((chunk, index) => ({
        doc_id: docData.id,
        chunk_index: i + index,
        chunk_content: chunk,
        embedding: embeddings[index],
        token_length: chunk.split(/\s+/).length,
      }));

      // Insert chunks into database
      const { error: chunkError } = await supabase
        .from('knowledge_doc_chunks')
        .insert(chunkRecords);

      if (chunkError) {
        logger.error('Failed to insert chunk records:', { error: chunkError.message });
        return res.status(500).json({ error: 'Failed to save chunks' });
      }

      // Upsert to Pinecone
      const pineconeRecords = chunkRecords.map((record, index) => ({
        id: `${docData.id}_${record.chunk_index}`,
        values: embeddings[index],
        metadata: {
          docId: docData.id,
          orgId,
          chunkIndex: record.chunk_index,
          tokenLength: record.token_length,
          text: record.chunk_content,
        },
      }));

      await upsertToPinecone(pineconeRecords);
    }

    // Clean up the temporary file
    fs.unlinkSync(uploadedFile.filepath);

    res.status(200).json({
      success: true,
      documentId: docData.id,
      chunksProcessed: chunks.length,
    });
  } catch (error: any) {
    logger.error('Error processing file upload:', { error: error.message });
    res.status(500).json({ error: 'Failed to process file' });
  }
} 