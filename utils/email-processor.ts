import { GmailMessage } from '@/types/gmail';
import { Database } from '@/types/supabase';
import { classifyEmail, generateDraft } from '@/utils/ai-responder';
import { parseGmailMessage } from '@/utils/email-parser';
import { createClient } from '@supabase/supabase-js';
import { classifyInboundEmail, decideAutoSend, generateRagResponse } from './ai-responder';
import { sendGmailReply } from './gmail';
import { logger } from './logger';
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Process a new inbound email with AI classification and potential auto-response
 */
export async function processInboundEmail(
  message: GmailMessage,
  orgId: string,
  ticketId: string
): Promise<{
  processed: boolean;
  classification?: string;
  confidence?: number;
  autoResponded?: boolean;
}> {
  try {
    // 1. Get the email content
    const emailText = message.body.html || message.body.text || message.snippet;
    if (!emailText) {
      logger.warn('No email content to process', { messageId: message.id });
      return { processed: false };
    }

    // 2. Create or get ticket_email_chats record
    const { data: chatRecord, error: chatError } = await supabase
      .from('ticket_email_chats')
      .insert({
        ticket_id: ticketId,
        message_id: message.id,
        thread_id: message.threadId,
        from_name: message.from.split('<')[0].trim(),
        from_address: message.from.match(/<(.+)>/)?.[1] || message.from,
        to_address: [message.to],
        subject: message.subject,
        body: emailText,
        gmail_date: new Date(message.date).toISOString(),
        org_id: orgId,
      })
      .select()
      .single();

    if (chatError || !chatRecord) {
      logger.error('Failed to create ticket_email_chats record', { error: chatError });
      return { processed: false };
    }

    // 3. Classify the email
    const { classification, confidence } = await classifyInboundEmail(emailText);

    // 4. Update chat record with classification
    await supabase
      .from('ticket_email_chats')
      .update({
        ai_classification: classification,
        ai_confidence: confidence,
      })
      .eq('id', chatRecord.id);

    // 5. If should_respond, generate RAG response
    if (classification === 'should_respond') {
      const { response: ragResponse, confidence: ragConfidence, references } = 
        await generateRagResponse(emailText, orgId);

      // 6. Decide if we should auto-send
      const { autoSend } = decideAutoSend(ragConfidence);

      if (autoSend) {
        try {
          // Send the email
          await sendGmailReply({
            threadId: message.threadId,
            inReplyTo: message.id,
            to: [message.from],
            subject: `Re: ${message.subject}`,
            htmlBody: ragResponse,
          });

          // Update record
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
            .eq('id', chatRecord.id);

          return {
            processed: true,
            classification,
            confidence,
            autoResponded: true,
          };
        } catch (sendError) {
          logger.error('Failed to auto-send email', { error: sendError });
          // Store as draft instead
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
            .eq('id', chatRecord.id);
        }
      } else {
        // Store as draft
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
          .eq('id', chatRecord.id);
      }

      return {
        processed: true,
        classification,
        confidence,
        autoResponded: false,
      };
    }

    return {
      processed: true,
      classification,
      confidence,
      autoResponded: false,
    };
  } catch (error) {
    logger.error('Error processing inbound email', { error });
    return { processed: false };
  }
} 