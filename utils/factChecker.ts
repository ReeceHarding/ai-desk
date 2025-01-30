import OpenAI from 'openai';
import { logger } from './logger';
import { queryPinecone } from './rag';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_BASE_URL,
});

type CorrectionType = 'contact_info' | 'amenity' | 'feature' | 'general';

interface Correction {
  original: string;
  correction: string;
  type?: CorrectionType;
  source?: string;
}

interface FactCheckResult {
  isFactual: boolean;
  confidence: number;
  corrections: Correction[];
  verifiedChunks: string[];
}

interface EvaluatorResponse {
  isFactual: boolean;
  confidence: number;
  corrections: Correction[];
}

/**
 * Evaluator agent that checks if all information in the response is supported by the context
 */
async function evaluateFactualAccuracy(
  response: string,
  contextChunks: { text: string; id: string }[]
): Promise<EvaluatorResponse> {
  const systemPrompt = `You are a fact-checking agent. Your task is to verify if the response ONLY contains information present in the provided context chunks.

Context chunks:
${contextChunks.map((chunk, i) => `[Chunk ${i + 1}]:\n${chunk.text}`).join('\n\n')}

Guidelines:
1. Check if EVERY piece of information in the response is explicitly supported by the context
2. Flag any information that is not directly found in the context
3. Do not allow any hallucinated details (e.g., contact information, specific numbers, or features not mentioned)
4. Be especially strict about contact information, prices, and specific claims
5. When marking corrections, include the entire phrase or sentence that needs correction
6. For contact information, if it's not in the context, mark the entire contact section for removal

Return a JSON object:
{
  "isFactual": boolean,
  "confidence": number (0-100),
  "corrections": [
    {
      "original": "problematic text",
      "correction": "correct version from context or 'remove' if no valid alternative",
      "type": "contact_info" | "amenity" | "feature" | "general"
    }
  ]
}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Response to verify:\n${response}` }
    ],
    temperature: 0.1,
    max_tokens: 500
  });

  try {
    const result = JSON.parse(completion.choices[0]?.message?.content || '{}');
    return {
      isFactual: result.isFactual || false,
      confidence: result.confidence || 0,
      corrections: result.corrections || []
    };
  } catch (error) {
    logger.error('Failed to parse evaluator response', { error });
    return {
      isFactual: false,
      confidence: 0,
      corrections: []
    };
  }
}

/**
 * Evaluator agent that checks for consistency and logical coherence
 */
async function evaluateConsistency(
  response: string,
  contextChunks: { text: string; id: string }[]
): Promise<EvaluatorResponse> {
  const systemPrompt = `You are a consistency-checking agent. Your task is to verify if the response is internally consistent and logically coherent with the context.

Context chunks:
${contextChunks.map((chunk, i) => `[Chunk ${i + 1}]:\n${chunk.text}`).join('\n\n')}

Guidelines:
1. Check for internal contradictions in the response
2. Verify logical flow and coherence
3. Ensure consistency with the context
4. Flag any inconsistent or contradictory statements

Return a JSON object:
{
  "isFactual": boolean,
  "confidence": number (0-100),
  "corrections": [
    {
      "original": "inconsistent text",
      "correction": "consistent version or 'remove' if no valid alternative"
    }
  ]
}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Response to verify:\n${response}` }
    ],
    temperature: 0.1,
    max_tokens: 500
  });

  try {
    const result = JSON.parse(completion.choices[0]?.message?.content || '{}');
    return {
      isFactual: result.isFactual || false,
      confidence: result.confidence || 0,
      corrections: result.corrections || []
    };
  } catch (error) {
    logger.error('Failed to parse evaluator response', { error });
    return {
      isFactual: false,
      confidence: 0,
      corrections: []
    };
  }
}

/**
 * Apply corrections to the response in a natural way
 */
export function applyCorrections(
  response: string,
  corrections: Correction[]
): string {
  let correctedResponse = response;

  // Sort corrections by type to handle them in the right order
  const typeOrder: Record<CorrectionType, number> = {
    contact_info: 1,
    amenity: 2,
    feature: 3,
    general: 4
  };

  const sortedCorrections = [...corrections].sort((a, b) => {
    const aType = a.type || 'general';
    const bType = b.type || 'general';
    return typeOrder[aType] - typeOrder[bType];
  });

  for (const correction of sortedCorrections) {
    if (correction.correction === 'remove') {
      // For contact information, remove the entire sentence
      if (correction.type === 'contact_info') {
        correctedResponse = correctedResponse.replace(/[^.!?]*\b${correction.original}\b[^.!?]*[.!?]/g, '');
        continue;
      }
      
      // For amenities or features, replace with appropriate alternative text
      if (correction.type === 'amenity' || correction.type === 'feature') {
        correctedResponse = correctedResponse.replace(
          correction.original,
          'amenities available in our resort'
        );
        continue;
      }

      // For other removals, replace with appropriate placeholder
      correctedResponse = correctedResponse.replace(
        correction.original,
        'information available upon request'
      );
    } else {
      correctedResponse = correctedResponse.replace(
        correction.original,
        correction.correction
      );
    }
  }

  // Clean up any double spaces or awkward punctuation
  correctedResponse = correctedResponse
    .replace(/\s+/g, ' ')
    .replace(/\s+\./g, '.')
    .replace(/\s+,/g, ',')
    .replace(/\.\s*\./g, '.')
    .trim();

  // Ensure proper email structure
  const parts = correctedResponse.split(/\n+/);
  if (parts.length >= 3) {
    const greeting = parts[0];
    const body = parts.slice(1, -2).join('\n\n');
    const signature = parts.slice(-2).join('\n');
    correctedResponse = `${greeting}\n\n${body}\n\n${signature}`;
  }

  return correctedResponse;
}

/**
 * Main fact-checking function that coordinates multiple evaluators
 */
export async function factCheck(
  response: string,
  embedding: number[],
  orgId: string,
  topK: number = 5
): Promise<FactCheckResult> {
  // 1. Get relevant context chunks from Pinecone
  const matches = await queryPinecone(embedding, topK, orgId, 0.7);
  const contextChunks = matches.map(match => ({
    text: match.metadata?.text || '',
    id: match.id || ''
  }));

  // 2. Run multiple evaluators in parallel
  const [factualAccuracy, consistency] = await Promise.all([
    evaluateFactualAccuracy(response, contextChunks),
    evaluateConsistency(response, contextChunks)
  ]);

  // 3. Combine and analyze evaluator results
  const isFactual = factualAccuracy.isFactual && consistency.isFactual;
  const confidence = Math.min(factualAccuracy.confidence, consistency.confidence);

  // 4. Combine corrections from both evaluators and apply them gracefully
  const corrections = [
    ...factualAccuracy.corrections.map(c => ({ ...c, source: 'factual_accuracy' })),
    ...consistency.corrections.map(c => ({ ...c, source: 'consistency' }))
  ];

  // 5. Log the fact-checking results
  logger.info('Fact check completed', {
    isFactual,
    confidence,
    correctionCount: corrections.length,
    evaluators: {
      factualAccuracy: {
        isFactual: factualAccuracy.isFactual,
        confidence: factualAccuracy.confidence
      },
      consistency: {
        isFactual: consistency.isFactual,
        confidence: consistency.confidence
      }
    }
  });

  return {
    isFactual,
    confidence,
    corrections,
    verifiedChunks: contextChunks.map(chunk => chunk.id)
  };
} 