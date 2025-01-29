import OpenAI from 'openai';
import { logger } from './logger';
import { generateEmbedding, queryPinecone } from './rag';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/**
 * Classify an inbound email text into "should_respond", "no_response", or "unknown".
 * Returns an object { classification, confidence }, with confidence in 0-100.
 */
export async function classifyInboundEmail(emailText: string): Promise<{
  classification: 'should_respond' | 'no_response' | 'unknown';
  confidence: number;  // 0-100
}> {
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

/**
 * Generate a RAG-based response for an inbound email using Pinecone & GPT-3.5.
 */
export async function generateRagResponse(
  emailText: string,
  orgId: string,
  topK: number = 5
): Promise<{ response: string; confidence: number; references: string[] }> {
  try {
    // Step 1: Embed the email text
    const embedding = await generateEmbedding(emailText);

    // Step 2: Query Pinecone for top K org-specific chunks
    const matches = await queryPinecone(embedding, topK);
    const filtered = matches.filter(m => m.metadata?.orgId === orgId);

    // Step 3: Prepare a context string from top chunks
    let contextString = '';
    const references: string[] = [];
    filtered.forEach((match, index) => {
      contextString += `\n[Chunk ${index + 1}]:\n${match.metadata?.text || ''}\n`;
      references.push(match.id || '');
    });

    // Step 4: Construct GPT system prompt
    const systemPrompt = `
You are a helpful support assistant with knowledge from the following context: 
${contextString}

User's question: "${emailText}"

You can only use the context provided. If not enough info, say "Not enough info."
Return a JSON object: { "answer": "...", "confidence": 0-100 } 
  - "answer": your best answer
  - "confidence": integer from 0 to 100
`;

    // Step 5: Chat completion
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
    let confidence = 60;

    try {
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
        finalAnswer = rawContent;
      }
    } catch (err) {
      logger.warn('Failed to parse RAG answer JSON from GPT', { content: rawContent, error: err });
      finalAnswer = rawContent;
    }

    logger.info('Generated RAG response', { finalAnswer, confidence, references });
    return { response: finalAnswer, confidence, references };
  } catch (error) {
    logger.error('RAG generation error', { error });
    return { response: 'Not enough info.', confidence: 50, references: [] };
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