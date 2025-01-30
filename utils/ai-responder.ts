import OpenAI from 'openai';
import { logger } from './logger';
import { generateEmbedding, queryPinecone } from './rag';

// Check if we're on the server side
const isServer = typeof window === 'undefined';

if (!isServer) {
  logger.warn('AI responder utilities should only be used on the server side');
}

// Only initialize OpenAI client on the server side
let openai: OpenAI | null = null;

if (isServer) {
  if (!process.env.OPENAI_API_KEY) {
    logger.error('OPENAI_API_KEY is not set in environment variables');
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_API_BASE_URL,
  });
}

/**
 * Classify an inbound email text into "should_respond", "no_response", or "unknown".
 * Returns an object { classification, confidence }, with confidence in 0-100.
 */
export async function classifyInboundEmail(emailText: string): Promise<{
  classification: 'should_respond' | 'no_response' | 'unknown';
  confidence: number;  // 0-100
}> {
  if (!isServer) {
    throw new Error('classifyInboundEmail can only be called on the server side');
  }
  
  if (!openai) {
    throw new Error('OpenAI client not initialized');
  }

  const systemPrompt = `
You are an email classifier. 
Decide if this inbound email is a real support question that needs a response 
or not. 
Return a JSON with "classification": one of ("should_respond","no_response","unknown"), 
and "confidence": an integer from 0 to 100. 
Respond ONLY with valid JSON. 
If uncertain, put classification = "unknown". 
If it's obviously spam or marketing, classification = "no_response". 
Otherwise classification = "should_respond". 
`;

  const userPrompt = `Email Text:\n${emailText}\n\nReturn JSON only: { "classification": "...", "confidence": 0-100 }`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.0,
      max_tokens: 200,
    });

    let content = completion.choices[0]?.message?.content?.trim() || '';
    let classification: 'should_respond' | 'no_response' | 'unknown' = 'unknown';
    let confidence = 50;

    try {
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const jsonString = content.slice(jsonStart, jsonEnd + 1);
        const parsed = JSON.parse(jsonString);
        if (parsed.classification === 'should_respond' || parsed.classification === 'no_response' || parsed.classification === 'unknown') {
          classification = parsed.classification;
        }
        if (typeof parsed.confidence === 'number') {
          confidence = Math.max(0, Math.min(100, parsed.confidence));
        }
      }
    } catch (err) {
      logger.warn('Failed to parse classification JSON from GPT', { content, error: err });
    }

    logger.info('Inbound email classified', { classification, confidence });
    return { classification, confidence };
  } catch (error) {
    logger.error('Classification error', { error });
    return { classification: 'unknown', confidence: 50 };
  }
}

export interface RagDebugInfo {
  chunks?: Array<{
    docId: string;
    text: string;
    similarity: number;
  }>;
  prompt?: {
    system: string;
    user: string;
    temperature: number;
    maxTokens: number;
  };
  modelResponse?: string;
  processingTimeMs?: number;
}

export interface RagResponse {
  response: string;
  confidence: number;
  references: string[];
  debugInfo?: RagDebugInfo;
}

/**
 * Generate a RAG-based response for an inbound email using Pinecone & GPT-3.5.
 * 
 * 1. We embed the email text.
 * 2. Query Pinecone for top K relevant chunks.
 * 3. Provide the chunk contexts + user email text to GPT to get a final answer + confidence.
 * 4. Return { response, confidence, references }.
 */
export async function generateRagResponse(
  emailText: string,
  orgId: string,
  topK: number = 5,
  debug: boolean = false
): Promise<RagResponse> {
  if (!isServer) {
    throw new Error('generateRagResponse can only be called on the server side');
  }
  
  if (!openai) {
    throw new Error('OpenAI client not initialized');
  }

  const startTime = Date.now();
  const debugInfo: RagDebugInfo = {};

  try {
    // Step 1: Embed the email text
    const embedding = await generateEmbedding(emailText);

    // Step 2: Query Pinecone for top K org-specific chunks
    const matches = await queryPinecone(embedding, topK, orgId);

    if (debug) {
      debugInfo.chunks = matches.map(match => ({
        docId: match.id?.split('_')[0] || '',
        text: match.metadata?.text || '',
        similarity: match.score || 0
      }));
    }

    // If no matches found, return early with "Not enough info"
    if (matches.length === 0) {
      logger.info('No relevant chunks found for query', { emailText, orgId });
      return { 
        response: 'Not enough info.', 
        confidence: 0, // Set to 0 when no matches found
        references: [],
        debugInfo: debug ? {
          ...debugInfo,
          processingTimeMs: Date.now() - startTime
        } : undefined
      };
    }

    // Step 3: Prepare a context string from chunks
    let contextString = '';
    const references: string[] = [];
    matches.forEach((match, index) => {
      contextString += `\n[Chunk ${index + 1}]:\n${match.metadata?.text || ''}\n`;
      references.push(match.id || '');
    });

    // Construct GPT system prompt
    const systemPrompt = `
You are a helpful support assistant with knowledge from the following context: 
${contextString}

User's question: "${emailText}"

You can only use the context provided. If not enough info, say "Not enough info."
Return a JSON object: { "answer": "...", "confidence": 0-100 } 
  - "answer": your best answer based ONLY on the provided context
  - "confidence": integer from 0 to 100, where:
    * 0-30: not enough relevant info in context
    * 31-70: partial match or uncertain
    * 71-100: high confidence answer from context
`;

    if (debug) {
      debugInfo.prompt = {
        system: systemPrompt,
        user: emailText,
        temperature: 0.2,
        maxTokens: 500
      };
    }

    // Step 4: Chat completion
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: emailText },
      ],
      temperature: 0.2,
      max_tokens: 500,
    });

    const rawContent = completion.choices[0]?.message?.content?.trim() || '';
    let finalAnswer = 'Not enough info.';
    let confidence = 0; // Default to 0 confidence

    if (debug) {
      debugInfo.modelResponse = rawContent;
    }

    try {
      // Attempt JSON parse
      const jsonStart = rawContent.indexOf('{');
      const jsonEnd = rawContent.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const jsonString = rawContent.slice(jsonStart, jsonEnd + 1);
        const parsed = JSON.parse(jsonString);
        if (parsed.answer) {
          finalAnswer = parsed.answer;
        }
        if (typeof parsed.confidence === 'number') {
          confidence = Math.max(0, Math.min(100, parsed.confidence));
        }
      } else {
        // If not JSON, use raw content as answer with low confidence
        finalAnswer = rawContent;
        confidence = 30; // Low confidence for non-JSON responses
      }
    } catch (err) {
      logger.warn('Failed to parse RAG answer JSON from GPT', { content: rawContent, error: err });
      finalAnswer = rawContent;
      confidence = 30; // Low confidence for parse errors
    }

    if (debug) {
      debugInfo.processingTimeMs = Date.now() - startTime;
    }

    logger.info('Generated RAG response', { finalAnswer, confidence, references });
    return { response: finalAnswer, confidence, references, debugInfo: debug ? debugInfo : undefined };
  } catch (error) {
    logger.error('RAG generation error', { error });
    return { 
      response: 'Not enough info.', 
      confidence: 0, // Set to 0 for errors
      references: [],
      debugInfo: debug ? {
        ...debugInfo,
        processingTimeMs: Date.now() - startTime
      } : undefined
    };
  }
}

/**
 * Decide if we auto-send or just store a draft, given a confidence threshold.
 */
export function decideAutoSend(
  confidence: number,
  threshold: number = 85
): { autoSend: boolean } {
  return { autoSend: confidence >= threshold };
} 