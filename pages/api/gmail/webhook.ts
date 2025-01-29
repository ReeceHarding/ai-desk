import { Database } from '@/types/supabase';
import { classifyInboundEmail, decideAutoSend, generateRagResponse } from '@/utils/ai-responder';
import { logger } from '@/utils/logger';
import { sendGmailReply } from '@/utils/server/gmail';
import { createClient } from '@supabase/supabase-js';
import rateLimit from 'express-rate-limit';
import { gmail_v1, google } from 'googleapis';
import { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';

type Schema$MessagePartHeader = gmail_v1.Schema$MessagePartHeader;

interface MessageHeader {
  name: string;
  value: string;
}

interface ProcessingMetrics {
  startTime: number;
  messageProcessingTime: number;
  totalMessages: number;
  successfulMessages: number;
  failedMessages: number;
}

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Request validation schema
const PubSubMessageSchema = z.object({
  message: z.object({
    data: z.string(),
    messageId: z.string(),
    publishTime: z.string()
  }).optional(),
  subscription: z.string()
});

// Apply rate limiting to the API route
const applyRateLimit = (req: NextApiRequest, res: NextApiResponse) =>
  new Promise((resolve, reject) => {
    limiter(req, res, (result: Error | unknown) =>
      result instanceof Error ? reject(result) : resolve(result)
    );
  });

async function getEmailBody(message: gmail_v1.Schema$Message): Promise<string> {
  const startTime = Date.now();
  await logger.info('Starting email body extraction', { messageId: message.id });

  if (!message.payload) {
    await logger.warn('No payload found in message', { messageId: message.id });
    return '';
  }

  // Function to decode base64 content
  const decodeBase64 = (data: string) => {
    try {
      return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
    } catch (error) {
      logger.error('Failed to decode base64 content', { error, messageId: message.id });
      return '';
    }
  };

  // Function to find HTML part
  const findHtmlPart = (parts: gmail_v1.Schema$MessagePart[]): gmail_v1.Schema$MessagePart | null => {
    for (const part of parts) {
      if (part.mimeType === 'text/html') {
        return part;
      }
      if (part.parts) {
        const htmlPart = findHtmlPart(part.parts);
        if (htmlPart) return htmlPart;
      }
    }
    return null;
  };

  let body = '';
  
  // If the message has parts, look for HTML content
  if (message.payload.parts) {
    await logger.info('Processing multipart message', { 
      messageId: message.id,
      partCount: message.payload.parts.length 
    });
    
    const htmlPart = findHtmlPart(message.payload.parts);
    if (htmlPart && htmlPart.body?.data) {
      body = decodeBase64(htmlPart.body.data);
      await logger.info('Found HTML part', { messageId: message.id });
    }
  }

  // If no HTML part found but there's body data, use that
  if (!body && message.payload.body?.data) {
    body = decodeBase64(message.payload.body.data);
    await logger.info('Using plain body data', { messageId: message.id });
  }

  // Fallback to snippet
  if (!body) {
    body = message.snippet || '';
    await logger.info('Using message snippet as fallback', { messageId: message.id });
  }

  const processingTime = Date.now() - startTime;
  await logger.info('Completed email body extraction', { 
    messageId: message.id,
    processingTime,
    bodyLength: body.length 
  });

  return body;
}

// Initialize Supabase client with service role
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CONFIDENCE_THRESHOLD = 85.00;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const metrics: ProcessingMetrics = {
    startTime: Date.now(),
    messageProcessingTime: 0,
    totalMessages: 0,
    successfulMessages: 0,
    failedMessages: 0,
  };

  try {
    // Apply rate limiting
    await applyRateLimit(req, res);

    if (req.method !== 'POST') {
      await logger.warn('Invalid method', { method: req.method });
      return res.status(405).json({ 
        error: 'Method not allowed',
        message: 'Only POST requests are accepted'
      });
    }

    // Verify PubSub token with more detailed error messages
    const secretToken = process.env.PUBSUB_SECRET_TOKEN;
    const authHeader = req.headers.authorization;

    if (secretToken) {
      if (!authHeader) {
        await logger.error('Missing authorization header');
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Missing authorization header'
        });
      }
      if (authHeader !== `Bearer ${secretToken}`) {
        await logger.error('Invalid authorization token');
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Invalid authorization token'
        });
      }
    } else {
      await logger.warn('PUBSUB_SECRET_TOKEN not configured, skipping token verification');
    }

    // Validate request body
    try {
      const validatedBody = PubSubMessageSchema.parse(req.body);
      if (!validatedBody.message?.data) {
        await logger.error('Missing message data in request');
        return res.status(400).json({ 
          error: 'Bad Request',
          message: 'Missing message data in request'
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        await logger.error('Invalid request body schema', { 
          errors: error.errors 
        });
        return res.status(400).json({ 
          error: 'Bad Request',
          message: 'Invalid request body schema',
          details: error.errors
        });
      }
      throw error;
    }

    const messageData = req.body;
    await logger.info('Received Gmail webhook', { 
      messageData,
      headers: req.headers,
      timestamp: new Date().toISOString(),
      body: req.body
    });

    // Handle PubSub notification
    let historyId: string | undefined;
    let emailAddress: string | undefined;
    
    if (messageData.message?.data) {
      try {
        const decodedData = JSON.parse(
          Buffer.from(messageData.message.data, 'base64').toString()
        );
        historyId = decodedData.historyId;
        emailAddress = decodedData.emailAddress;
        await logger.info('Decoded PubSub data', { 
          decodedData,
          hasHistoryId: !!historyId,
          hasEmailAddress: !!emailAddress
        });
      } catch (error) {
        await logger.error('Failed to decode PubSub data', { 
          error,
          rawData: messageData.message?.data
        });
        return res.status(400).json({ error: 'Invalid message data' });
      }
    } else {
      await logger.error('No message data in PubSub notification');
      return res.status(400).json({ error: 'No message data' });
    }

    // Get organization with Gmail integration
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id, gmail_access_token, gmail_refresh_token, gmail_history_id')
      .not('gmail_access_token', 'is', null);

    if (orgsError) {
      await logger.error('Failed to fetch organizations', { 
        error: orgsError,
        errorMessage: orgsError.message,
        errorDetails: orgsError.details 
      });
      return res.status(500).json({ error: 'Failed to fetch organizations' });
    }

    if (!orgs || orgs.length === 0) {
      await logger.error('No organizations found with Gmail tokens');
      return res.status(404).json({ error: 'No organizations found with Gmail tokens' });
    }

    // Process for each organization with Gmail tokens
    for (const org of orgs) {
      if (!org.gmail_access_token || !org.gmail_refresh_token) {
        await logger.error('Organization missing Gmail tokens', { orgId: org.id });
        continue;
      }

      await logger.info('Processing organization with Gmail integration', { 
        orgId: org.id,
        hasAccessToken: !!org.gmail_access_token,
        hasRefreshToken: !!org.gmail_refresh_token,
        currentHistoryId: org.gmail_history_id,
        newHistoryId: historyId
      });

      const oauth2Client = new google.auth.OAuth2(
        process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        process.env.NEXT_PUBLIC_GMAIL_REDIRECT_URI
      );

      oauth2Client.setCredentials({
        access_token: org.gmail_access_token,
        refresh_token: org.gmail_refresh_token,
      });

      // Add token refresh handler
      oauth2Client.on('tokens', async (tokens) => {
        if (tokens.access_token) {
          await supabase
            .from('organizations')
            .update({
              gmail_access_token: tokens.access_token,
              ...(tokens.refresh_token && { gmail_refresh_token: tokens.refresh_token })
            })
            .eq('id', org.id);
          
          await logger.info('Updated Gmail tokens', { 
            orgId: org.id,
            hasNewAccessToken: !!tokens.access_token,
            hasNewRefreshToken: !!tokens.refresh_token
          });
        }
      });

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      // Get Gmail user profile to verify the organization
      try {
        const profile = await gmail.users.getProfile({ userId: 'me' });
        await logger.info('Gmail profile fetched', {
          orgId: org.id,
          emailAddress: profile.data.emailAddress
        });
      } catch (error) {
        await logger.error('Failed to fetch Gmail profile', {
          error,
          orgId: org.id
        });
        continue;
      }

      // If we have a history ID, get changes since last check
      if (historyId && org.gmail_history_id) {
        try {
          const historyResponse = await gmail.users.history.list({
            userId: 'me',
            startHistoryId: org.gmail_history_id
          });

          await logger.info('Gmail history response', {
            orgId: org.id,
            historyCount: historyResponse.data.history?.length,
            hasHistory: !!historyResponse.data.history
          });

          if (historyResponse.data.history) {
            for (const history of historyResponse.data.history) {
              if (history.messagesAdded) {
                for (const messageAdded of history.messagesAdded) {
                  if (!messageAdded.message?.id) continue;

                  try {
                    const fullMessageResponse = await gmail.users.messages.get({
                      userId: 'me',
                      id: messageAdded.message.id,
                      format: 'full'
                    });

                    // Process the message
                    await processMessage(fullMessageResponse.data, org.id, gmail);
                    metrics.successfulMessages++;
                  } catch (error) {
                    metrics.failedMessages++;
                    await logger.error('Failed to process message from history', {
                      error,
                      messageId: messageAdded.message.id,
                      orgId: org.id
                    });
                  }
                }
              }
            }
          }
        } catch (error) {
          await logger.error('Failed to get Gmail history', {
            error,
            orgId: org.id,
            startHistoryId: org.gmail_history_id
          });
        }
      }

      // Fallback to listing recent messages
      try {
        const messagesResponse = await gmail.users.messages.list({
          userId: 'me',
          q: 'newer_than:10m',
          maxResults: 10
        });

        await logger.info('Gmail messages list response', { 
          orgId: org.id,
          resultSizeEstimate: messagesResponse.data.resultSizeEstimate,
          nextPageToken: messagesResponse.data.nextPageToken,
          hasMessages: !!messagesResponse.data.messages?.length,
          messageIds: messagesResponse.data.messages?.map(m => m.id)
        });

        const messages = messagesResponse.data.messages;
        if (!messages) {
          await logger.info('No new messages found', { orgId: org.id });
          continue;
        }

        metrics.totalMessages += messages.length;

        // Process each message
        for (const message of messages) {
          const messageStartTime = Date.now();
          try {
            if (!message.id) {
              await logger.warn('Message missing ID', { message });
              continue;
            }

            const fullMessageResponse = await gmail.users.messages.get({
              userId: 'me',
              id: message.id,
              format: 'full'
            });

            // Process the message
            await processMessage(fullMessageResponse.data, org.id, gmail);
            metrics.successfulMessages++;
            metrics.messageProcessingTime += Date.now() - messageStartTime;
          } catch (error) {
            metrics.failedMessages++;
            await logger.error('Failed to process message', {
              error,
              messageId: message.id,
              orgId: org.id
            });
          }
        }
      } catch (error) {
        await logger.error('Failed to list Gmail messages', {
          error,
          orgId: org.id
        });
      }

      // Update history ID if provided
      if (historyId) {
        try {
          await supabase
            .from('organizations')
            .update({ gmail_history_id: historyId })
            .eq('id', org.id);
        } catch (error) {
          await logger.error('Failed to update history ID', {
            error,
            orgId: org.id,
            historyId
          });
        }
      }
    }

    // Log final metrics
    const totalProcessingTime = Date.now() - metrics.startTime;
    await logger.info('Webhook processing completed', { 
      totalProcessingTime,
      messageProcessingTime: metrics.messageProcessingTime,
      totalMessages: metrics.totalMessages,
      successfulMessages: metrics.successfulMessages,
      failedMessages: metrics.failedMessages,
      averageMessageProcessingTime: metrics.totalMessages ? metrics.messageProcessingTime / metrics.totalMessages : 0
    });

    return res.status(200).json({ 
      status: 'success',
      metrics: {
        totalProcessingTime,
        totalMessages: metrics.totalMessages,
        successfulMessages: metrics.successfulMessages,
        failedMessages: metrics.failedMessages
      }
    });
  } catch (error) {
    await logger.error('Webhook processing error', { 
      error,
      processingTime: Date.now() - metrics.startTime
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function processMessage(message: gmail_v1.Schema$Message, orgId: string, gmailClient: gmail_v1.Gmail) {
  const startTime = Date.now();
  await logger.info('Processing message', { 
    messageId: message.id,
    threadId: message.threadId,
    orgId
  });

  if (!message.payload) {
    await logger.error('Message has no payload', { messageId: message.id });
    return;
  }

  // Extract headers
  const headers = message.payload.headers || [];
  const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value;

  const subject = getHeader('subject') || 'No Subject';
  const from = getHeader('from') || '';
  const to = getHeader('to') || '';
  const cc = getHeader('cc') || '';
  const bcc = getHeader('bcc') || '';
  const fromMatch = from.match(/(?:"?([^"]*)"?\s*)?(?:<(.+)>)/);
  const fromName = fromMatch ? fromMatch[1]?.trim() : '';
  const fromAddress = fromMatch ? fromMatch[2] : from;

  // Helper to convert email string to array
  const emailsToArray = (emails: string): string[] => {
    if (!emails) return [];
    return emails.split(',').map(e => {
      const match = e.match(/<(.+)>/);
      return match ? match[1].trim() : e.trim();
    }).filter(Boolean);
  };

  // Get message body
  const body = await getEmailBody(message);

  // Process attachments
  const attachments: { filename: string; mimeType: string; size: number; path: string }[] = [];
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const processAttachmentPart = async (part: gmail_v1.Schema$MessagePart) => {
    if (part.filename && part.body?.attachmentId) {
      try {
        // Check file size
        const size = Number(part.body.size || '0');
        if (size > MAX_FILE_SIZE) {
          await logger.warn('Attachment too large', {
            filename: part.filename,
            size,
            maxSize: MAX_FILE_SIZE
          });
          return;
        }

        // Only process allowed MIME types
        const allowedMimeTypes = [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'image/gif',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain'
        ];

        if (!allowedMimeTypes.includes(part.mimeType || '')) {
          await logger.warn('Unsupported attachment type', {
            filename: part.filename,
            mimeType: part.mimeType
          });
          return;
        }

        // Get the attachment data from Gmail
        const attachment = await gmailClient.users.messages.attachments.get({
          userId: 'me',
          messageId: message.id || '',
          id: part.body.attachmentId || ''
        }).then(response => response.data);

        if (!attachment.data) {
          throw new Error('No attachment data received');
        }

        // Decode the attachment data
        const buffer = Buffer.from(attachment.data, 'base64');
        
        // Generate a safe filename
        const safeFilename = part.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
        const timestamp = Date.now();
        const storagePath = `${orgId}/${message.id}/${timestamp}_${safeFilename}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase
          .storage
          .from('email-attachments')
          .upload(storagePath, buffer, {
            contentType: part.mimeType || 'application/octet-stream',
            cacheControl: '3600'
          });

        if (uploadError) {
          throw uploadError;
        }

        // Get the public URL
        const { data: { publicUrl } } = supabase
          .storage
          .from('email-attachments')
          .getPublicUrl(storagePath);

        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType || 'application/octet-stream',
          size,
          path: storagePath
        });

        await logger.info('Processed and stored attachment', {
          filename: part.filename,
          size,
          mimeType: part.mimeType,
          path: storagePath
        });
      } catch (error) {
        await logger.error('Failed to process attachment', {
          error,
          filename: part.filename
        });
      }
    }

    // Recursively process nested parts
    if (part.parts) {
      for (const nestedPart of part.parts) {
        await processAttachmentPart(nestedPart);
      }
    }
  };

  if (message.payload.parts) {
    for (const part of message.payload.parts) {
      await processAttachmentPart(part);
    }
  }

  // Find or create profile for sender
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', fromAddress)
    .single();

  let profileId: string;

  if (existingProfile) {
    profileId = existingProfile.id;
  } else {
    // Create new profile for the sender
    const { data: newProfile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        email: fromAddress,
        role: 'customer',
        org_id: orgId,
        display_name: fromName || fromAddress.split('@')[0],
        metadata: {
          source: 'gmail_webhook',
          created_at: new Date().toISOString()
        },
        extra_json_1: {},
        avatar_url: 'https://placehold.co/400x400/png?text=👤'
      })
      .select()
      .single();

    if (profileError) {
      await logger.error('Failed to create profile', {
        error: profileError,
        email: fromAddress
      });
      throw profileError;
    }

    profileId = newProfile.id;
  }

  // Create or update ticket
  let ticketId: string;
  const { data: existingTicket } = await supabase
    .from('tickets')
    .select('id')
    .eq('metadata->thread_id', message.threadId)
    .single();

  if (existingTicket) {
    ticketId = existingTicket.id;
    // Update existing ticket
    await supabase
      .from('tickets')
      .update({
        updated_at: new Date().toISOString(),
        status: 'open'
      })
      .eq('id', ticketId);
  } else {
    // Create new ticket
    const { data: newTicket, error: ticketError } = await supabase
      .from('tickets')
      .insert({
        subject,
        description: body,
        customer_id: profileId,
        org_id: orgId,
        status: 'open',
        priority: 'medium',
        metadata: {
          thread_id: message.threadId,
          source: 'gmail',
          message_id: message.id
        }
      })
      .select()
      .single();

    if (ticketError) {
      await logger.error('Failed to create ticket', {
        error: ticketError,
        subject,
        threadId: message.threadId
      });
      throw ticketError;
    }

    ticketId = newTicket.id;
  }

  // Create ticket_email_chat entry
  const { data: chatRecord, error: chatError } = await supabase
    .from('ticket_email_chats')
    .insert({
      ticket_id: ticketId,
      message_id: message.id,
      thread_id: message.threadId,
      from_name: fromName,
      from_address: fromAddress,
      to_address: emailsToArray(to),
      cc_address: emailsToArray(cc),
      bcc_address: emailsToArray(bcc),
      subject,
      body,
      attachments: attachments.length > 0 ? attachments : {},
      gmail_date: message.internalDate 
        ? new Date(parseInt(message.internalDate.toString())).toISOString()
        : new Date().toISOString(),
      org_id: orgId,
      ai_classification: 'unknown',
      ai_confidence: 0,
      ai_auto_responded: false,
      ai_draft_response: null
    })
    .select()
    .single();

  if (chatError) {
    await logger.error('Failed to create email chat', {
      error: chatError,
      messageId: message.id,
      ticketId
    });
    throw chatError;
  }

  // Step 1: Classify the email
  const { classification, confidence } = await classifyInboundEmail(body);

  // Step 2: If should_respond, generate RAG response
  if (classification === 'should_respond') {
    const { response: ragResponse, confidence: ragConfidence, references } = await generateRagResponse(
      body,
      orgId,
      5
    );

    // Step 3: Decide auto-send vs. draft
    const { autoSend } = decideAutoSend(ragConfidence, CONFIDENCE_THRESHOLD);

    const referencesObj = { rag_references: references };

    if (autoSend) {
      // Auto-send the response
      try {
        await sendGmailReply({
          threadId: message.threadId,
          inReplyTo: message.id,
          to: [fromAddress],
          subject: `Re: ${subject || 'Support Request'}`,
          htmlBody: ragResponse,
        });

        // Update chat record
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

        logger.info('Auto-sent AI response', {
          chatId: chatRecord.id,
          confidence: ragConfidence,
        });
      } catch (sendError) {
        logger.error('Failed to auto-send email', { error: sendError });
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

      logger.info('Stored AI draft response', {
        chatId: chatRecord.id,
        confidence: ragConfidence,
      });
    }
  }

  const processingTime = Date.now() - startTime;
  await logger.info('Completed message processing', {
    messageId: message.id,
    ticketId,
    processingTime,
    attachmentCount: attachments.length
  });
} 