import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import { logger } from './logger';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Initialize Pinecone client
const pc = new Pinecone();

// Create index instance
const pineconeIndex = pc.index(process.env.PINECONE_INDEX || 'ai-desk-rag-embeddings');

logger.info('Pinecone client initialized');

/**
 * Generate an embedding for a text using OpenAI's API
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    logger.error('Failed to generate embedding', { error });
    throw error;
  }
}

/**
 * Split text into chunks with optional overlap
 */
export function splitIntoChunks(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 200
): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentLength = 0;

  for (const word of words) {
    if (currentLength + word.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
      // Keep last N words for overlap
      const overlapWords = currentChunk.slice(-Math.floor(overlap / 10));
      currentChunk = [...overlapWords];
      currentLength = overlapWords.join(' ').length;
    }
    currentChunk.push(word);
    currentLength += word.length + 1; // +1 for space
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }

  return chunks;
}

export interface PineconeMatch {
  id: string;
  score?: number;
  metadata?: {
    orgId?: string;
    text?: string;
    [key: string]: any;
  };
}

/**
 * Query Pinecone for similar vectors
 */
export async function queryPinecone(
  embedding: number[],
  topK: number = 5
): Promise<PineconeMatch[]> {
  try {
    const queryResponse = await pineconeIndex.query({
      vector: embedding,
      topK,
      includeMetadata: true,
    });

    return queryResponse.matches || [];
  } catch (error) {
    logger.error('Failed to query Pinecone', { error });
    return [];
  }
}

/**
 * Upsert vectors to Pinecone
 */
export async function upsertToPinecone(vectors: {
  id: string;
  values: number[];
  metadata?: Record<string, any>;
}[]): Promise<void> {
  try {
    await pineconeIndex.upsert(vectors);
    logger.info('Successfully upserted vectors to Pinecone', { count: vectors.length });
  } catch (error) {
    logger.error('Failed to upsert to Pinecone', { error });
    throw error;
  }
}

/**
 * Calculate token length of a text string
 * This is a simple approximation - for more accurate counts, use tiktoken
 */
export function estimateTokenLength(text: string): number {
  return Math.ceil(text.split(/\s+/).length * 1.3);
} 