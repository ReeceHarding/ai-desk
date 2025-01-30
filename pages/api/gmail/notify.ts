import { ParsedEmail } from '@/types/gmail';
import { Database } from '@/types/supabase';
import { classifyInboundEmail, decideAutoSend, generateRagResponse } from '@/utils/ai-responder';
import { sendGmailReply } from '@/utils/gmail';
import { handleInboundEmail } from '@/utils/inbound-email';
import { logger } from '@/utils/logger';
import { createClient } from '@supabase/supabase-js';
import { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CONFIDENCE_THRESHOLD = 85.00;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages } = req.body;
    let processedCount = 0;

    for (const message of messages) {
      try {
        // Extract email content
        const emailText = message.bodyHtml || message.bodyText || '(No content)';
        const fromAddress = message.fromEmail;
        const orgId = message.orgId; // Assuming this is passed or determined

        // Construct ParsedEmail object
        const parsedEmail: ParsedEmail = {
          id: message.id,
          threadId: message.threadId,
          historyId: message.historyId || '',
          from: fromAddress,
          to: Array.isArray(message.to) ? message.to : [message.to],
          cc: message.cc ? (Array.isArray(message.cc) ? message.cc : [message.cc]) : [],
          bcc: message.bcc ? (Array.isArray(message.bcc) ? message.bcc : [message.bcc]) : [],
          subject: message.subject || '',
          date: new Date(message.date || Date.now()).toISOString(),
          bodyText: message.bodyText || message.snippet || '',
          bodyHtml: message.bodyHtml || '',
          attachments: message.attachments || []
        };

        // Create or update ticket
        const { ticketId } = await handleInboundEmail(parsedEmail, orgId);

        // Get the ticket_email_chats record
        const { data: chatRecord, error: chatError } = await supabase
          .from('ticket_email_chats')
          .select('*')
          .eq('message_id', message.id)
          .single();

        if (chatError || !chatRecord) {
          logger.error('Failed to find ticket_email_chats record', { error: chatError, messageId: message.id });
          continue;
        }

        // Classify the email
        const { classification, confidence } = await classifyInboundEmail(emailText);

        // Update classification in database
        await supabase
          .from('ticket_email_chats')
          .update({
            ai_classification: classification,
            ai_confidence: confidence,
          })
          .eq('id', chatRecord.id);

        // If should respond, generate RAG response
        if (classification === 'should_respond') {
          const { response: ragResponse, confidence: ragConfidence, references } = 
            await generateRagResponse(emailText, orgId, 5);

          // Decide if we should auto-send
          const { autoSend } = decideAutoSend(ragConfidence, CONFIDENCE_THRESHOLD);

          const referencesObj = { rag_references: references };

          if (autoSend) {
            try {
              // Send the email
              await sendGmailReply({
                threadId: message.threadId,
                inReplyTo: message.id,
                to: [fromAddress],
                subject: `Re: ${message.subject || 'Support Request'}`,
                htmlBody: ragResponse,
                orgId,
              });

              // Update database to reflect auto-send
              await supabase
                .from('ticket_email_chats')
                .update({
                  ai_auto_responded: true,
                  ai_draft_response: ragResponse,
                  metadata: {
                    ...chatRecord.metadata,
                    ...referencesObj,
                  },
                })
                .eq('id', chatRecord.id);

              logger.info('Auto-sent RAG response', { 
                messageId: message.id, 
                confidence: ragConfidence 
              });
            } catch (sendError) {
              logger.error('Failed to auto-send email', { sendError });
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
                  ...referencesObj,
                },
              })
              .eq('id', chatRecord.id);

            logger.info('Stored RAG response as draft', { 
              messageId: message.id, 
              confidence: ragConfidence 
            });
          }
        }

        processedCount++;
      } catch (msgError) {
        logger.error('Error processing individual message', { 
          msgError, 
          messageId: message.id 
        });
      }
    }

    return res.status(200).json({ 
      status: 'ok', 
      processed: processedCount 
    });
  } catch (error) {
    logger.error('Error in notify handler', { error });
    return res.status(500).json({ error: String(error) });
  }
} 
