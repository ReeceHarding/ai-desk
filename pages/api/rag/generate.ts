import { Database } from '@/types/supabase';
import { generateRagResponse } from '@/utils/ai-responder';
import { logger } from '@/utils/logger';
import { createClient } from '@supabase/supabase-js';
import { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { emailText, orgId, messageHistory, senderInfo } = req.body;

  if (!emailText || !orgId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Log the input context
    logger.info('Starting RAG response generation', {
      orgId,
      emailTextLength: emailText.length,
      emailTextPreview: emailText.substring(0, 200) + '...',
      messageHistoryCount: messageHistory?.length || 0,
      senderInfo
    });

    // If we have message history, construct a context string
    let fullContext = emailText;
    if (messageHistory?.length) {
      const historyContext = messageHistory
        .map((msg: any, idx: number) => `[Previous Message ${idx + 1}]:\n${msg.body}`)
        .join('\n\n');
      fullContext = `${emailText}\n\nPrevious Context:\n${historyContext}`;
      
      logger.info('Added message history to context', {
        historyMessagesCount: messageHistory.length,
        totalContextLength: fullContext.length,
        historyPreview: historyContext.substring(0, 200) + '...'
      });
    }

    // Fetch the knowledge base documents for this organization
    const { data: knowledgeDocs } = await supabase
      .from('knowledge_docs')
      .select('id, title')
      .eq('org_id', orgId);

    logger.info('Found knowledge base documents', {
      documentCount: knowledgeDocs?.length || 0,
      documents: knowledgeDocs?.map(doc => ({
        id: doc.id,
        title: doc.title
      }))
    });

    // Generate the RAG response with detailed chunk logging
    const { response, confidence, references, debugInfo } = await generateRagResponse(
      fullContext,
      orgId,
      5,
      true, // Enable debug mode
      senderInfo // Pass sender information
    );

    // Log the chunks that were used
    if (debugInfo?.chunks) {
      logger.info('Knowledge base chunks used for response', {
        totalChunks: debugInfo.chunks.length,
        chunks: debugInfo.chunks.map((chunk: any, idx: number) => ({
          index: idx + 1,
          docId: chunk.docId,
          docTitle: knowledgeDocs?.find(doc => doc.id === chunk.docId)?.title,
          similarity: chunk.similarity,
          textPreview: chunk.text.substring(0, 200) + '...'
        }))
      });
    }

    // Log the prompt construction
    if (debugInfo?.prompt) {
      logger.info('RAG prompt construction', {
        systemPrompt: debugInfo.prompt.system,
        userPrompt: debugInfo.prompt.user,
        temperature: debugInfo.prompt.temperature,
        maxTokens: debugInfo.prompt.maxTokens
      });
    }

    // Log the model's raw response
    if (debugInfo?.modelResponse) {
      logger.info('Raw model response', {
        rawResponse: debugInfo.modelResponse,
        parsedConfidence: confidence,
        finalResponse: response
      });
    }

    // Log the final results
    logger.info('Generated RAG response', {
      confidence,
      responseLength: response.length,
      responsePreview: response.substring(0, 200) + '...',
      referencesCount: references.length,
      references,
      processingTimeMs: debugInfo?.processingTimeMs
    });

    return res.status(200).json({
      response,
      confidence,
      references,
      debug: {
        ...debugInfo,
        chunks: debugInfo?.chunks?.map((chunk: any) => ({
          ...chunk,
          docTitle: knowledgeDocs?.find(doc => doc.id === chunk.docId)?.title
        }))
      }
    });
  } catch (error) {
    logger.error('RAG generation error:', { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ error: 'Failed to generate response' });
  }
} 
