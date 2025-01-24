import { Pinecone } from '@pinecone-database/pinecone';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { logger } from './logger';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Pinecone client
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize Pinecone index
async function getPineconeIndex() {
  try {
    return pinecone.index(process.env.PINECONE_INDEX_NAME!);
  } catch (error: any) {
    logger.error('Failed to get Pinecone index:', { error: error.message });
    throw new Error(`Pinecone index initialization failed: ${error.message}`);
  }
}

/**
 * Split text into chunks of approximately equal size
 */
export function splitIntoChunks(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 200
): string[] {
  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    // Calculate end index with overlap
    let endIndex = startIndex + chunkSize;
    
    // If this isn't the last chunk, try to break at a sentence or paragraph
    if (endIndex < text.length) {
      // Look for common sentence endings within the last 100 characters of the chunk
      const searchArea = text.slice(Math.max(endIndex - 100, startIndex), endIndex);
      const lastPeriod = searchArea.lastIndexOf('.');
      const lastNewline = searchArea.lastIndexOf('\n');
      
      // If we found a good break point, adjust endIndex
      if (lastPeriod !== -1 || lastNewline !== -1) {
        endIndex = endIndex - (100 - Math.max(lastPeriod, lastNewline));
      }
    }

    chunks.push(text.slice(startIndex, endIndex));
    // Move start index forward by chunk size minus overlap
    startIndex = endIndex - overlap;
  }

  return chunks;
}

/**
 * Generate embeddings for a text chunk using OpenAI's API
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text,
    });

    return response.data[0].embedding;
  } catch (error: any) {
    logger.error('Failed to generate embedding:', { error: error.message });
    throw new Error(`Embedding generation failed: ${error.message}`);
  }
}

interface PineconeRecord {
  id: string;
  values: number[];
  metadata?: Record<string, any>;
}

/**
 * Upsert vectors to Pinecone
 */
export async function upsertToPinecone(records: PineconeRecord[]) {
  try {
    const index = await getPineconeIndex();
    await index.upsert(records);
    logger.info(`Successfully upserted ${records.length} vectors to Pinecone`);
  } catch (error: any) {
    logger.error('Failed to upsert to Pinecone:', { error: error.message });
    throw new Error(`Pinecone upsert failed: ${error.message}`);
  }
}

/**
 * Query Pinecone for similar vectors
 */
export async function queryPinecone(
  queryEmbedding: number[],
  topK: number = 5
) {
  try {
    const index = await getPineconeIndex();
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true
    });

    return queryResponse.matches || [];
  } catch (error: any) {
    logger.error('Failed to query Pinecone:', { error: error.message });
    throw new Error(`Pinecone query failed: ${error.message}`);
  }
}

/**
 * Calculate token length of a text string
 * This is a simple approximation - for more accurate counts, use tiktoken
 */
export function estimateTokenLength(text: string): number {
  return Math.ceil(text.split(/\s+/).length * 1.3);
} 