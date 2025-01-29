import { GmailMessage, GmailMessagePart } from '@/types/gmail';
import { classifyInboundEmail, generateRagResponse } from '@/utils/ai-responder';
import { processInboundEmail } from '@/utils/email-processor';
import { logger } from '@/utils/logger';
import { createTicketFromEmail, refreshGmailTokens, setupGmailWatch } from '@/utils/server/gmail';
import { createClient } from '@supabase/supabase-js';
import rateLimit from 'express-rate-limit';
import { gmail_v1, google } from 'googleapis';
import { NextApiRequest, NextApiResponse } from 'next';

// Initialize rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const gmail = google.gmail('v1');

interface ExtendedGmailMessage extends GmailMessage {
  from?: string;
  to?: string;
  subject?: string;
  date?: string;
  body?: {
    text?: string;
    html?: string;
  };
}

// Validate Pub/Sub message
function validatePubSubMessage(req: NextApiRequest): boolean {
  // Verify required headers
  const requiredHeaders = [
    'x-goog-resource-state',
    'x-goog-resource-id',
    'x-goog-resource-uri',
    'x-goog-message-number'
  ];

  for (const header of requiredHeaders) {
    if (!req.headers[header]) {
      logger.error(`Missing required header: ${header}`);
      return false;
    }
  }

  // Verify request body
  if (!req.body || typeof req.body !== 'object') {
    logger.error('Invalid request body');
    return false;
  }

  const { emailAddress, historyId } = req.body;
  if (!emailAddress || !historyId) {
    logger.error('Missing required body parameters');
    return false;
  }

  return true;
}

// Handle watch expiration
async function handleWatchExpiration(mailbox: any, type: 'organization' | 'profile'): Promise<void> {
  try {
    logger.info('Attempting to refresh expired watch', { 
      type, 
      id: mailbox.id 
    });

    const watchResult = await setupGmailWatch({
      access_token: mailbox.gmail_access_token,
      refresh_token: mailbox.gmail_refresh_token,
      token_type: 'Bearer',
      scope: 'https://www.googleapis.com/auth/gmail.modify',
      expiry_date: Date.now() + 3600000 // 1 hour
    },
    type,
    mailbox.id);

    if (watchResult.expiration) {
      const expirationDate = new Date(watchResult.expiration);
      await supabase
        .from(type === 'organization' ? 'organizations' : 'profiles')
        .update({
          gmail_watch_status: 'active',
          gmail_watch_expiry: expirationDate.toISOString(),
          gmail_watch_resource_id: watchResult.resourceId,
          updated_at: new Date().toISOString()
        })
        .eq('id', mailbox.id);

      logger.info('Successfully refreshed expired watch', {
        type,
        id: mailbox.id,
        resourceId: watchResult.resourceId,
        expiration: expirationDate.toISOString()
      });
    } else {
      throw new Error('Watch setup did not return expiration time');
    }
  } catch (error) {
    logger.error('Failed to refresh expired watch', {
      type,
      id: mailbox.id,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

function convertMessagePart(part: gmail_v1.Schema$MessagePart | null): GmailMessagePart | null {
  if (!part) return null;

  return {
    partId: part.partId || undefined,
    mimeType: part.mimeType || undefined,
    filename: part.filename || undefined,
    headers: part.headers?.map((h: { name?: string | null; value?: string | null }) => ({
      name: h.name || '',
      value: h.value || '',
    })),
    body: part.body ? {
      attachmentId: part.body.attachmentId || undefined,
      size: part.body.size || undefined,
      data: part.body.data || undefined,
    } : undefined,
    parts: part.parts?.map((p: gmail_v1.Schema$MessagePart) => convertMessagePart(p))
      .filter((p): p is GmailMessagePart => p !== null) || undefined,
  };
}

// Add a simple decideAutoSend function since it's not exported from ai-responder
function decideAutoSend(confidence: number, threshold: number) {
  return {
    autoSend: confidence >= threshold
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Apply rate limiting
  try {
    await new Promise((resolve, reject) => {
      limiter(req, res, (result: any) => {
        if (result instanceof Error) {
          reject(result);
        }
        resolve(result);
      });
    });
  } catch (error) {
    logger.error('Rate limit exceeded');
    return res.status(429).json({ error: 'Too many requests' });
  }

  try {
    // Validate the request
    if (!validatePubSubMessage(req)) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    // Verify the request is from Google
    const resourceState = req.headers['x-goog-resource-state'];
    const resourceId = req.headers['x-goog-resource-id'];
    
    if (!resourceState || !resourceId) {
      logger.error('Missing required headers');
      return res.status(400).json({ error: 'Missing required headers' });
    }

    // Handle different notification types
    switch (resourceState) {
      case 'exists': {
        // New message notification
        const data = req.body as { emailAddress: string; historyId: string };
        const { emailAddress, historyId } = data;
        
        // Find the organization or user with this email and matching resource ID
        const { data: org } = await supabase
          .from('organizations')
          .select('id, gmail_refresh_token, gmail_access_token, gmail_watch_status, gmail_watch_resource_id')
          .eq('email', emailAddress)
          .eq('gmail_watch_resource_id', resourceId)
          .single();

        const { data: profile } = await supabase
          .from('profiles')
          .select('id, gmail_refresh_token, gmail_access_token, gmail_watch_status, gmail_watch_resource_id')
          .eq('email', emailAddress)
          .eq('gmail_watch_resource_id', resourceId)
          .single();

        const mailbox = org || profile;
        if (!mailbox) {
          logger.error(`No mailbox found for email: ${emailAddress} and resourceId: ${resourceId}`);
          return res.status(404).json({ error: 'Mailbox not found' });
        }

        // Check watch status
        if (mailbox.gmail_watch_status !== 'active') {
          try {
            await handleWatchExpiration(mailbox, org ? 'organization' : 'profile');
          } catch (error) {
            logger.error('Failed to handle watch expiration', {
              error: error instanceof Error ? error.message : String(error)
            });
            // Continue processing the current message even if watch refresh fails
          }
        }

        // Get new messages since historyId
        const auth = new google.auth.OAuth2();
        auth.setCredentials({
          access_token: mailbox.gmail_access_token,
          refresh_token: mailbox.gmail_refresh_token,
        });

        let response;
        try {
          response = await gmail.users.history.list({
            auth,
            userId: 'me',
            startHistoryId: historyId,
          });
        } catch (error: any) {
          // Handle token expiry
          if (error.response?.status === 401) {
            logger.info('Access token expired, refreshing...');
            const newTokens = await refreshGmailTokens(mailbox.gmail_refresh_token);
            
            // Update auth with new token
            auth.setCredentials({
              access_token: newTokens.access_token,
              refresh_token: newTokens.refresh_token,
            });

            // Retry the request
            response = await gmail.users.history.list({
              auth,
              userId: 'me',
              startHistoryId: historyId,
            });
          } else {
            throw error;
          }
        }

        const history = response.data.history || [];
        let processedCount = 0;
        let errorCount = 0;
        
        // Process each message
        for (const item of history) {
          if (item.messagesAdded) {
            for (const messageAdded of item.messagesAdded) {
              if (messageAdded.message?.id) {
                try {
                  // Fetch full message content
                  const messageResponse = await gmail.users.messages.get({
                    auth,
                    userId: 'me',
                    id: messageAdded.message.id,
                    format: 'full',
                  });

                  const message = messageResponse.data;
                  if (message && message.payload) {
                    // Convert Gmail API message to our GmailMessage type
                    const gmailMessage: ExtendedGmailMessage = {
                      id: message.id!,
                      threadId: message.threadId!,
                      labelIds: message.labelIds || [],
                      snippet: message.snippet || '',
                      historyId: message.historyId || '',
                      internalDate: message.internalDate || '',
                      payload: convertMessagePart(message.payload),
                      sizeEstimate: message.sizeEstimate || 0,
                      // Extended properties
                      from: message.payload?.headers?.find(h => h.name === 'From')?.value || '',
                      to: message.payload?.headers?.find(h => h.name === 'To')?.value || '',
                      subject: message.payload?.headers?.find(h => h.name === 'Subject')?.value || '',
                      date: message.payload?.headers?.find(h => h.name === 'Date')?.value || new Date().toISOString(),
                      body: {
                        text: message.payload?.body?.data 
                          ? Buffer.from(message.payload.body.data, 'base64').toString()
                          : undefined,
                        html: message.payload?.mimeType?.includes('html') && message.payload?.body?.data
                          ? Buffer.from(message.payload.body.data, 'base64').toString()
                          : undefined
                      }
                    };

                    // Parse the message for ticket creation
                    const parsedEmail = {
                      id: gmailMessage.id,
                      threadId: gmailMessage.threadId,
                      historyId: gmailMessage.historyId,
                      from: gmailMessage.from || '',
                      to: gmailMessage.to ? [gmailMessage.to] : [],
                      subject: gmailMessage.subject || '',
                      date: gmailMessage.date || new Date().toISOString(),
                      bodyText: gmailMessage.body?.text,
                      bodyHtml: gmailMessage.body?.html,
                      attachments: []
                    };
                    
                    // Create ticket from email
                    const { ticketId } = await createTicketFromEmail(parsedEmail, org?.id || profile?.id || '');

                    if (!ticketId) {
                      throw new Error('Failed to create ticket');
                    }

                    // Process with AI
                    const aiResult = await processInboundEmail(
                      gmailMessage,
                      org?.id || profile?.id || '',
                      ticketId
                    );

                    // Add AI classification and RAG
                    const messageText = gmailMessage.body?.text || gmailMessage.body?.html || '';
                    const classification = await classifyInboundEmail(messageText);
                    const { classification: emailClass, confidence: classConfidence } = classification;

                    // Update the chat record with classification
                    const { error: updateError } = await supabase
                      .from('ticket_email_chats')
                      .update({
                        ai_classification: emailClass,
                        ai_confidence: classConfidence,
                      })
                      .eq('message_id', gmailMessage.id);

                    if (updateError) {
                      logger.error('Failed to update classification', { updateError });
                    }

                    // If should respond, generate RAG response
                    if (emailClass === 'should_respond') {
                      const { response: ragResponse, confidence: ragConfidence, references } = await generateRagResponse(
                        messageText,
                        org?.id || profile?.id || '',
                        5
                      );

                      // Decide auto-send vs. draft
                      const { autoSend } = decideAutoSend(ragConfidence, 85.00);

                      // Store response and references
                      const { error: ragError } = await supabase
                        .from('ticket_email_chats')
                        .update({
                          ai_draft_response: ragResponse,
                          ai_auto_responded: autoSend,
                          metadata: {
                            rag_references: references
                          }
                        })
                        .eq('message_id', gmailMessage.id);

                      if (ragError) {
                        logger.error('Failed to store RAG response', { ragError });
                      }

                      // If auto-send, send the email
                      if (autoSend) {
                        try {
                          await gmail.users.messages.send({
                            auth,
                            userId: 'me',
                            requestBody: {
                              threadId: gmailMessage.threadId,
                              raw: Buffer.from(
                                `To: ${gmailMessage.from}\r\n` +
                                `Subject: Re: ${gmailMessage.subject}\r\n` +
                                `Content-Type: text/html; charset=utf-8\r\n` +
                                `References: ${gmailMessage.id}\r\n` +
                                `In-Reply-To: ${gmailMessage.id}\r\n\r\n` +
                                ragResponse
                              ).toString('base64')
                            }
                          });

                          logger.info('Auto-sent RAG response', {
                            messageId: gmailMessage.id,
                            confidence: ragConfidence
                          });
                        } catch (sendError) {
                          logger.error('Failed to auto-send response', { sendError });
                        }
                      }
                    }

                    logger.info('Processed inbound email with AI', {
                      messageId: message.id,
                      ticketId,
                      aiResult
                    });

                    processedCount++;
                  }
                } catch (error) {
                  logger.error('Failed to process message', {
                    error: error instanceof Error ? error.message : String(error),
                    messageId: messageAdded.message.id
                  });
                  errorCount++;
                }
              }
            }
          }
        }

        logger.info('Completed processing Gmail notification', {
          emailAddress,
          historyId,
          totalProcessed: processedCount,
          errors: errorCount
        });

        break;
      }
      
      case 'sync':
        // Initial sync notification, no action needed
        logger.info('Received sync notification');
        break;

      case 'delete':
        // Watch was deleted, should re-establish
        logger.warn('Watch was deleted, should re-establish');
        // The watch will be re-established by the cron job
        break;

      default:
        logger.warn(`Unknown resource state: ${resourceState}`);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error processing Gmail notification:', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
} 