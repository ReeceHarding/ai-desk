import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import { logger } from './logger';

// Check if we're on the server side
const isServer = typeof window === 'undefined';

if (!isServer) {
  logger.warn('RAG utilities should only be used on the server side');
}

// Only initialize OpenAI client on the server side
let openai: OpenAI | null = null;
let pc: Pinecone | null = null;
let pineconeIndex: any = null;

if (isServer) {
  if (!process.env.OPENAI_API_KEY) {
    logger.error('OPENAI_API_KEY is not set in environment variables');
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_API_BASE_URL,
  });

  // Initialize Pinecone client
  pc = new Pinecone();
  pineconeIndex = pc.index(process.env.PINECONE_INDEX || 'ai-desk-rag-embeddings');
  logger.info('Pinecone client initialized');
}

/**
 * Generate an embedding for a text using OpenAI's API
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!isServer) {
    throw new Error('generateEmbedding can only be called on the server side');
  }
  
  if (!openai) {
    throw new Error('OpenAI client not initialized');
  }

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
  chunkSize: number = 1500,
  overlap: number = 300
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
  topK: number = 5,
  orgId?: string,
  minScore: number = 0.5
): Promise<PineconeMatch[]> {
  if (!isServer) {
    throw new Error('queryPinecone can only be called on the server side');
  }

  if (!pineconeIndex) {
    throw new Error('Pinecone client not initialized');
  }

  try {
    // First try without filter to verify embeddings exist
    const testResponse = await pineconeIndex.query({
      vector: embedding,
      topK: 1,
      includeMetadata: true
    });
    
    logger.info('Test query without filter', {
      hasMatches: (testResponse.matches || []).length > 0,
      firstMatchScore: testResponse.matches?.[0]?.score,
      firstMatchMetadata: testResponse.matches?.[0]?.metadata
    });

    logger.info('Querying Pinecone', { 
      topK,
      orgId,
      minScore,
      filterApplied: !!orgId
    });

    const queryResponse = await pineconeIndex.query({
      vector: embedding,
      topK,
      includeMetadata: true,
      filter: orgId ? {
        $or: [
          { orgId: { $eq: orgId } },  // camelCase
          { org_id: { $eq: orgId } }  // snake_case
        ]
      } : undefined
    });

    // Log raw matches before filtering
    const rawMatches = queryResponse.matches || [];
    logger.info('Raw Pinecone matches', {
      totalMatches: rawMatches.length,
      matchScores: rawMatches.map((m: PineconeMatch) => m.score),
      matchMetadata: rawMatches.map((m: PineconeMatch) => ({
        id: m.id,
        orgId: m.metadata?.orgId,
        hasText: !!m.metadata?.text
      }))
    });

    // Filter out matches below the threshold after getting results
    const matches = rawMatches.filter((match: PineconeMatch) => (match.score || 0) >= minScore);
    
    logger.info('Filtered Pinecone matches', {
      totalMatches: matches.length,
      matchScores: matches.map((m: PineconeMatch) => m.score),
      threshold: minScore
    });

    return matches;
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
  if (!isServer) {
    throw new Error('upsertToPinecone can only be called on the server side');
  }

  if (!pineconeIndex) {
    throw new Error('Pinecone client not initialized');
  }

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