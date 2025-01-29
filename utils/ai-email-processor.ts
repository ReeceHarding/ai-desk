import type { Database } from '@/types/supabase';
import { createClient } from '@supabase/supabase-js';
import { classifyInboundEmail, decideAutoSend, generateRagResponse } from './ai-responder';
import { sendGmailReply } from './gmail';
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
 * 3. If confidence high enough, auto-send
 * 4. Otherwise, save as draft
 */
export async function processInboundEmailWithAI(
  chatId: string,
  emailBody: string,
  orgId: string
): Promise<ProcessEmailResult> {
  try {
    // Step 1: Classify the email
    const { classification, confidence } = await classifyInboundEmail(emailBody);

    // Update classification in database
    await supabase
      .from('ticket_email_chats')
      .update({
        ai_classification: classification,
        ai_confidence: confidence,
      })
      .eq('id', chatId);

    // If we shouldn't respond, return early
    if (classification !== 'should_respond') {
      return { classification, confidence, autoResponded: false };
    }

    // Step 2: Generate RAG response
    const { response: ragResponse, confidence: ragConfidence, references } = await generateRagResponse(
      emailBody,
      orgId,
      5
    );

    // Step 3: Decide if we should auto-send
    const { autoSend } = decideAutoSend(ragConfidence);

    // Get the chat record for sending
    const { data: chatRecord } = await supabase
      .from('ticket_email_chats')
      .select('*')
      .eq('id', chatId)
      .single();

    if (!chatRecord) {
      throw new Error('Chat record not found');
    }

    // Step 4: Auto-send or save as draft
    if (autoSend) {
      try {
        // Send the email
        await sendGmailReply({
          threadId: chatRecord.thread_id,
          inReplyTo: chatRecord.message_id,
          to: Array.isArray(chatRecord.from_address) 
            ? chatRecord.from_address 
            : [chatRecord.from_address],
          subject: `Re: ${chatRecord.subject || 'Support Request'}`,
          htmlBody: ragResponse,
        });

        // Update the record
        await supabase
          .from('ticket_email_chats')
          .update({
            ai_auto_responded: true,
            ai_draft_response: ragResponse,
            metadata: {
              ...chatRecord.metadata,
              rag_references: references,
            },
          })
          .eq('id', chatId);

        logger.info('Auto-sent AI response', { chatId, confidence: ragConfidence });

        return {
          classification,
          confidence,
          autoResponded: true,
          draftResponse: ragResponse,
          references,
        };
      } catch (sendError) {
        logger.error('Failed to auto-send email', { error: sendError });
        // Fall through to saving as draft
      }
    }

    // Save as draft
    await supabase
      .from('ticket_email_chats')
      .update({
        ai_auto_responded: false,
        ai_draft_response: ragResponse,
        metadata: {
          ...chatRecord.metadata,
          rag_references: references,
        },
      })
      .eq('id', chatId);

    logger.info('Saved AI response as draft', { chatId, confidence: ragConfidence });

    return {
      classification,
      confidence,
      autoResponded: false,
      draftResponse: ragResponse,
      references,
    };
  } catch (error) {
    logger.error('Error processing email with AI', { error, chatId });
    throw error;
  }
}

/**
 * Send a previously drafted AI response
 */
export async function sendDraftResponse(chatId: string): Promise<void> {
  try {
    // Get the chat record
    const { data: chatRecord } = await supabase
      .from('ticket_email_chats')
      .select('*')
      .eq('id', chatId)
      .single();

    if (!chatRecord || !chatRecord.ai_draft_response) {
      throw new Error('No draft response found');
    }

    // Send the email
    await sendGmailReply({
      threadId: chatRecord.thread_id,
      inReplyTo: chatRecord.message_id,
      to: Array.isArray(chatRecord.from_address) 
        ? chatRecord.from_address 
        : [chatRecord.from_address],
      subject: `Re: ${chatRecord.subject || 'Support Request'}`,
      htmlBody: chatRecord.ai_draft_response,
    });

    // Update the record
    await supabase
      .from('ticket_email_chats')
      .update({
        ai_auto_responded: true,
      })
      .eq('id', chatId);

    logger.info('Sent draft AI response', { chatId });
  } catch (error) {
    logger.error('Error sending draft response', { error, chatId });
    throw error;
  }
} 