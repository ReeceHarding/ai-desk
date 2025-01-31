import type { Database } from '@/types/supabase';
import { createClient } from '@supabase/supabase-js';
import { classifyInboundEmail, generateRagResponse } from './ai-responder';
import { logger } from './logger';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ProcessEmailResult {
  classification: 'should_respond' | 'no_response' | 'unknown';
  confidence: number;
  autoResponded: boolean;
  draftResponse?: string;
  references?: string[];
}

/**
 * Process an inbound email with AI:
 * 1. Classify if it needs a response
 * 2. If yes, generate RAG response
 * 3. Save as draft (never auto-send)
 */
export async function processInboundEmailWithAI(
  chatId: string,
  emailBody: string,
  orgId: string
): Promise<ProcessEmailResult> {
  try {
    logger.info('Starting AI email processing', {
      chatId,
      orgId,
      emailLength: emailBody.length
    });

    const { classification, confidence } = await classifyInboundEmail(emailBody);
    logger.info('Email classified', {
      chatId,
      classification,
      confidence,
      timestamp: new Date().toISOString()
    });

    const { response: ragResponse, confidence: ragConfidence, references } = await generateRagResponse(
      emailBody,
      orgId,
      5
    );
    logger.info('RAG response generated', {
      chatId,
      responseLength: ragResponse.length,
      confidence: ragConfidence,
      referencesCount: references.length,
      timestamp: new Date().toISOString()
    });

    // Get the chat record for saving draft
    const { data: chatRecord, error: chatError } = await supabase
      .from('ticket_email_chats')
      .select('*')
      .eq('id', chatId)
      .single();

    if (chatError || !chatRecord) {
      logger.error('Chat record not found', {
        chatId,
        error: chatError,
        timestamp: new Date().toISOString()
      });
      throw new Error('Chat record not found');
    }

    // Save as draft (never auto-send)
    const { error: draftError } = await supabase
      .from('ticket_email_chats')
      .update({
        ai_auto_responded: false,
        ai_draft_response: ragResponse,
        metadata: {
          ...chatRecord.metadata,
          rag_references: references,
          draft_created_at: new Date().toISOString(),
          draft_metrics: {
            classification_confidence: confidence,
            rag_confidence: ragConfidence,
            references_used: references.length,
            response_length: ragResponse.length,
            processing_time: Date.now() - new Date(chatRecord.created_at).getTime()
          }
        },
      })
      .eq('id', chatId);

    if (draftError) {
      logger.error('Failed to save draft', {
        chatId,
        error: draftError,
        timestamp: new Date().toISOString()
      });
      throw draftError;
    }

    logger.info('AI draft saved successfully', {
      chatId,
      classification,
      confidence,
      ragConfidence,
      referencesCount: references.length,
      responseLength: ragResponse.length,
      timestamp: new Date().toISOString()
    });

    return {
      classification,
      confidence,
      autoResponded: false,
      draftResponse: ragResponse,
      references,
    };
  } catch (error) {
    logger.error('AI processing failed', {
      chatId,
      error,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

/**
 * Send a previously drafted AI response
 */
export async function sendDraftResponse(chatId: string): Promise<void> {
  try {
    logger.info('Starting draft response sending', {
      chatId,
      timestamp: new Date().toISOString()
    });

    // Get the chat record
    const { data: chatRecord, error: chatError } = await supabase
      .from('ticket_email_chats')
      .select('*')
      .eq('id', chatId)
      .single();

    if (chatError || !chatRecord) {
      logger.error('Chat record not found for sending', {
        chatId,
        error: chatError,
        timestamp: new Date().toISOString()
      });
      throw new Error('Chat record not found');
    }

    if (!chatRecord.ai_draft_response) {
      logger.error('No draft response found', {
        chatId,
        timestamp: new Date().toISOString()
      });
      throw new Error('No draft response found');
    }

    // Update the record to mark as sent
    const { error: updateError } = await supabase
      .from('ticket_email_chats')
      .update({
        ai_auto_responded: true,
        metadata: {
          ...chatRecord.metadata,
          draft_sent_at: new Date().toISOString(),
          draft_metrics: {
            ...(chatRecord.metadata?.draft_metrics || {}),
            time_to_send: Date.now() - new Date(chatRecord.metadata?.draft_created_at || chatRecord.created_at).getTime()
          }
        }
      })
      .eq('id', chatId);

    if (updateError) {
      logger.error('Failed to update draft status', {
        chatId,
        error: updateError,
        timestamp: new Date().toISOString()
      });
      throw updateError;
    }

    logger.info('Draft response sent successfully', {
      chatId,
      responseLength: chatRecord.ai_draft_response.length,
      timeSinceDraft: Date.now() - new Date(chatRecord.metadata?.draft_created_at || chatRecord.created_at).getTime(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to send draft', {
      chatId,
      error,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
} 