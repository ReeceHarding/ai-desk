import { Client } from "langsmith";
import { traceable } from "langsmith/traceable";
import OpenAI from 'openai';
import { applyCorrections, factCheck } from './factChecker';
import { logger } from './logger';
import { generateEmbedding, queryPinecone } from './rag';

// Check if we're on the server side
const isServer = typeof window === 'undefined';

if (!isServer) {
  // logger.warn('AI responder utilities should only be used on the server side');
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

// Initialize LangSmith client
let langsmith: Client | null = null;
if (isServer && process.env.LANGCHAIN_TRACING_V2 === 'true') {
  try {
    langsmith = new Client({
      apiUrl: process.env.LANGCHAIN_ENDPOINT,
      apiKey: process.env.LANGCHAIN_API_KEY,
    });
    logger.info('LangSmith client initialized successfully', {
      project: process.env.LANGCHAIN_PROJECT,
      endpoint: process.env.LANGCHAIN_ENDPOINT
    });
  } catch (error) {
    logger.error('Failed to initialize LangSmith client', { error });
  }
}

/**
 * Classify an inbound email text into "should_respond", "no_response", or "unknown".
 * Returns an object { classification, confidence }, with confidence in 0-100.
 */
// Wrap classification with tracing
const classifyInboundEmailWithTrace = traceable(
  async (emailText: string): Promise<{
    classification: 'should_respond' | 'no_response' | 'unknown';
    confidence: number;  // 0-100
  }> => {
    if (!isServer) {
      throw new Error('classifyInboundEmail can only be called on the server side');
    }
    
    if (!openai) {
      throw new Error('OpenAI client not initialized');
    }

    logger.info('Starting email classification with LangSmith tracing', {
      project: process.env.LANGCHAIN_PROJECT,
      tracing: process.env.LANGCHAIN_TRACING_V2
    });

    try {
      const systemPrompt = `You are an expert email classifier for a helpdesk system. Your task is to determine if an incoming email is promotional/marketing/automated or requires a human response.

DETAILED CLASSIFICATION RULES:

1. Mark as PROMOTIONAL (isPromotional: true) if the email:
   - Contains any marketing language or promotional offers
   - Is from a no-reply email address
   - Contains words like "newsletter", "update", "announcement", "offer", "discount"
   - Is an automated system notification (e.g., password changes, login alerts, CI/CD notifications)
   - Contains tracking numbers or order confirmations
   - Is a social media notification or alert
   - Is a mass-sent newsletter or company update
   - Contains promotional imagery or multiple marketing links
   - Is an automated calendar invite or reminder
   - Contains phrases like "Don't miss out", "Limited time", "Special offer"
   - Is an automated receipt or transaction confirmation
   - Contains unsubscribe links or marketing footers
   - Is from known marketing domains or bulk email services
   - Uses HTML-heavy formatting typical of marketing emails
   - Is a GitHub Actions or CI/CD workflow notification
   - Is an automated build/test/deployment notification

2. Mark as NEEDS_RESPONSE (isPromotional: false) if the email:
   - Contains direct questions requiring human judgment
   - Includes specific technical issues or bug reports that need investigation
   - Contains personal or unique inquiries
   - References previous conversations or tickets
   - Includes screenshots or specific problem descriptions
   - Contains urgent support requests or time-sensitive issues
   - Includes phrases like "Please help", "I need assistance", "Can someone explain"
   - Contains detailed customer feedback requiring analysis
   - Includes business proposals or partnership inquiries
   - Contains specific account or service questions
   - Includes personal contact information for follow-up
   - References specific transactions or interactions
   - Contains unique situations not covered by FAQs
   - Shows signs of human authorship (typos, conversational tone)

ANALYSIS STEPS:
1. Check sender address and format
2. Scan for automated/marketing indicators
3. Look for personal/human elements
4. Evaluate content complexity
5. Check for direct questions or requests
6. Analyze tone and urgency
7. Look for unique/specific details

OUTPUT FORMAT:
You must respond in this exact JSON format with only these two fields:
{
    "isPromotional": boolean,
    "reason": "Brief explanation of classification decision"
}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Please classify this email:\n${emailText}` },
        ],
        temperature: 0.1,
        max_tokens: 150,
      });

      const rawContent = completion.choices[0]?.message?.content?.trim() || '';
      let isPromotional = false;
      let reason = '';

      try {
        const jsonStart = rawContent.indexOf('{');
        const jsonEnd = rawContent.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          const jsonString = rawContent.slice(jsonStart, jsonEnd + 1);
          const parsed = JSON.parse(jsonString);
          isPromotional = parsed.isPromotional;
          reason = parsed.reason;
        }
      } catch (err) {
        logger.warn('Failed to parse classification JSON', { content: rawContent, error: err });
        return { classification: 'unknown', confidence: 0 };
      }

      // Return the classification with high confidence since we're using a strict rule set
      return {
        classification: isPromotional ? 'no_response' : 'should_respond',
        confidence: 90
      };
    } catch (error) {
      logger.error('Classification error', { error });
      return { classification: 'unknown', confidence: 0 };
    }
  },
  {
    name: "classify_inbound_email",
    tags: ["production", "support-agent", "classification"],
    metadata: {
      useCase: "email-classification",
      component: "classifier",
      environment: process.env.NODE_ENV || 'development'
    }
  }
);

// Export the traced version
export const classifyInboundEmail = classifyInboundEmailWithTrace;

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
  factCheck?: {
    isFactual: boolean;
    corrections: Array<{
      original: string;
      correction: string;
      type?: string;
    }>;
    confidence: number;
  };
}

export interface RagResponse {
  response: string;
  confidence: number;
  references: string[];
  debugInfo?: RagDebugInfo;
}

// Wrap response generation with tracing
const generateRagResponseWithTrace = traceable(
  async (
    emailText: string,
    orgId: string,
    topK: number = 5,
    debug: boolean = false,
    senderInfo?: { 
      fromName?: string;
      agentName?: string;
    }
  ): Promise<RagResponse> => {
    if (!isServer) {
      throw new Error('generateRagResponse can only be called on the server side');
    }
    
    if (!openai) {
      throw new Error('OpenAI client not initialized');
    }

    logger.info('Starting RAG response generation with LangSmith tracing', {
      project: process.env.LANGCHAIN_PROJECT,
      tracing: process.env.LANGCHAIN_TRACING_V2,
      orgId,
      topK,
      debug
    });

    const startTime = Date.now();
    const debugInfo: RagDebugInfo = {};

    try {
      // Step 1: Embed the email text
      const embedding = await generateEmbedding(emailText);

      // Step 2: Query Pinecone for top K org-specific chunks
      const matches = await queryPinecone(embedding, topK, orgId, 0.7);

      if (debug) {
        debugInfo.chunks = matches.map(match => ({
          docId: match.id?.split('_')[0] || '',
          text: match.metadata?.text || '',
          similarity: match.score || 0
        }));
      }

      // If no matches found, return early with "Not enough info"
      if (matches.length === 0) {
        return { 
          response: 'Not enough info.', 
          confidence: 0,
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

      // Extract customer name from email if available
      const customerName = senderInfo?.fromName?.split(' ')[0] || 'there';
      const agentFirstName = senderInfo?.agentName?.split(' ')[0] || 'Support Agent';

      // Construct GPT system prompt with stronger factual accuracy guidelines
      const systemPrompt = `
You are a knowledgeable support agent crafting email responses. Use ONLY the following context to answer the customer's question:
${contextString}

CRITICAL GUIDELINES:
1. Be concise but specific - aim for 3-4 well-structured paragraphs
2. Start with a warm but brief greeting using "${customerName}"
3. Focus on answering the specific question or addressing the main concern
4. End with a simple "Best regards," followed by "${agentFirstName}"
5. Maintain a professional yet friendly tone
6. ONLY include information that is EXPLICITLY present in the provided context
7. DO NOT make up or hallucinate any information, especially:
   - Contact information
   - Specific numbers or statistics
   - Features or services not mentioned
   - Prices or dates
8. If information is not in the context, say "I don't have that information" instead of making assumptions
9. Format with proper HTML line breaks and paragraphs:
   - Use <p> tags for paragraphs with margin-bottom
   - Use <br/> for line breaks within paragraphs
   - One blank line after greeting
   - One blank line between paragraphs
   - One blank line before sign-off
10. When listing amenities or features:
    - Group similar items together
    - Use bullet points for clarity
    - Include specific details from the context
11. For room descriptions:
    - List exact square footage if available
    - Mention specific amenities in the room
    - Describe the view or location if mentioned
12. For contact information:
    - Only include verified email/phone from context
    - Format consistently with proper spacing

User's email: "${emailText}"

Return a JSON object: { 
  "answer": "...", 
  "confidence": 0-100 
} where:
- "answer": your complete email response with proper HTML formatting
- "confidence": integer from 0 to 100, where:
  * 0-30: not enough relevant info
  * 31-70: partial match or uncertain
  * 71-100: high confidence answer

If you cannot answer based on the context, respond with "Not enough info." and low confidence.`;

      if (debug) {
        debugInfo.prompt = {
          system: systemPrompt,
          user: emailText,
          temperature: 0.2,
          maxTokens: 500
        };
      }

      // Step 4: Generate initial response
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
      let confidence = 0;

      if (debug) {
        debugInfo.modelResponse = rawContent;
      }

      try {
        // Parse the initial response
        const jsonStart = rawContent.indexOf('{');
        const jsonEnd = rawContent.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          const jsonString = rawContent.slice(jsonStart, jsonEnd + 1);
          const parsed = JSON.parse(jsonString);
          if (parsed.answer) {
            // Process the answer to ensure proper HTML formatting
            finalAnswer = parsed.answer
              .replace(/\n{2,}/g, '</p><p>') // Convert multiple newlines to paragraph breaks
              .replace(/\n/g, '<br/>') // Convert single newlines to line breaks
              .replace(/\s{2,}/g, ' &nbsp;'.repeat(2)) // Preserve multiple spaces
              .trim();
            
            // Ensure the response is wrapped in paragraphs
            if (!finalAnswer.startsWith('<p>')) {
              finalAnswer = `<p>${finalAnswer}</p>`;
            }
          }
          if (typeof parsed.confidence === 'number') {
            confidence = Math.max(0, Math.min(100, parsed.confidence));
          }
        } else {
          finalAnswer = `<p>${rawContent}</p>`;
          confidence = 30;
        }

        // Step 5: Fact check the response
        const factCheckResult = await factCheck(finalAnswer, embedding, orgId, topK);
        
        // If fact check failed or corrections needed
        if (!factCheckResult.isFactual || factCheckResult.corrections.length > 0) {
          // Apply corrections to create a verified response
          const correctedAnswer = applyCorrections(finalAnswer, factCheckResult.corrections);
          finalAnswer = correctedAnswer;
          confidence = Math.min(confidence, factCheckResult.confidence);

          // If the response is too mangled after corrections, fall back to a simpler response
          if (finalAnswer.includes('information available upon request') || 
              finalAnswer.split('\n\n').length < 3) {
            finalAnswer = `Hi ${customerName},\n\nThank you for your interest in Las Canas Beach Retreat. For detailed information about our amenities and services, please contact us directly.\n\nBest regards,\n${agentFirstName}`;
            confidence = 30;
          }
        }

        if (debug) {
          debugInfo.factCheck = {
            isFactual: factCheckResult.isFactual,
            corrections: factCheckResult.corrections,
            confidence: factCheckResult.confidence
          };
        }

      } catch (err) {
        // logger.warn('Failed to parse or fact-check response', { content: rawContent, error: err });
        finalAnswer = 'Not enough info.';
        confidence = 0;
      }

      if (debug) {
        debugInfo.processingTimeMs = Date.now() - startTime;
      }

      // logger.info('Generated RAG response', { 
      //   finalAnswer, 
      //   confidence, 
      //   references,
      //   factChecked: true
      // });
      
      return { 
        response: finalAnswer, 
        confidence, 
        references, 
        debugInfo: debug ? debugInfo : undefined 
      };
    } catch (error) {
      logger.error('Error generating RAG response', { error, emailText, orgId });
      return { 
        response: 'An error occurred while generating the response.', 
        confidence: 0,
        references: [],
        debugInfo: debug ? {
          ...debugInfo,
          processingTimeMs: Date.now() - startTime
        } : undefined
      };
    }
  },
  {
    name: "generate_rag_response",
    tags: ["production", "support-agent", "rag"],
    metadata: {
      useCase: "email-response",
      component: "rag-qa",
      environment: process.env.NODE_ENV || 'development'
    }
  }
);

// Export the traced version
export const generateRagResponse = generateRagResponseWithTrace;

/**
 * Decide if we auto-send or just store a draft, given a confidence threshold.
 * Returns { autoSent: boolean, finalResponse: string }.
 */
export function decideAutoSend(
  confidence: number,
  threshold: number = 75  // Lowered from 85 to be less aggressive
): { autoSend: boolean } {
  return { autoSend: confidence >= threshold };
}

export interface EmailClassification {
  isPromotional: boolean;
  needsDraft: boolean;
}

export async function classifyEmail(email: { subject: string; body: string }): Promise<EmailClassification> {
  return {
    isPromotional: false,
    needsDraft: true,
  };
}

export async function generateDraft(email: { subject: string; body: string }): Promise<string> {
  return 'AI generated response';
} 