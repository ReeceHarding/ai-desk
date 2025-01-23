import { Database } from '@/types/supabase';
import { logger } from '@/utils/logger';
import { createClient } from '@supabase/supabase-js';
import { gmail_v1, google } from 'googleapis';
import { NextApiRequest, NextApiResponse } from 'next';

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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const metrics: ProcessingMetrics = {
    startTime: Date.now(),
    messageProcessingTime: 0,
    totalMessages: 0,
    successfulMessages: 0,
    failedMessages: 0,
  };

  if (req.method !== 'POST') {
    await logger.warn('Invalid method', { method: req.method });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const messageData = req.body;
    await logger.info('Received Gmail webhook', { 
      messageData,
      headers: req.headers,
      timestamp: new Date().toISOString(),
      body: req.body
    });

    // Handle PubSub notification
    let historyId: string | undefined;
    if (messageData.message?.data) {
      try {
        const decodedData = JSON.parse(
          Buffer.from(messageData.message.data, 'base64').toString()
        );
        historyId = decodedData.historyId;
        await logger.info('Decoded PubSub data', { decodedData });
      } catch (error) {
        await logger.error('Failed to decode PubSub data', { error });
      }
    }

    // Get organization with Gmail integration
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, gmail_access_token, gmail_refresh_token, gmail_history_id')
      .eq('id', 'ee0f56a0-4130-4398-bc2d-27529f82efb1')
      .single();

    if (orgError) {
      await logger.error('Failed to fetch organization', { 
        error: orgError,
        errorMessage: orgError.message,
        errorDetails: orgError.details 
      });
      return res.status(500).json({ error: 'Failed to fetch organization' });
    }

    if (!org) {
      await logger.error('Organization not found');
      return res.status(404).json({ error: 'Organization not found' });
    }

    if (!org.gmail_access_token || !org.gmail_refresh_token) {
      await logger.error('Organization missing Gmail tokens', { orgId: org.id });
      return res.status(400).json({ error: 'Organization missing Gmail tokens' });
    }

    await logger.info('Found organization with Gmail integration', { 
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

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

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
                  await processMessage(fullMessageResponse.data, org.id);
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
        return res.status(200).json({ 
          status: 'success',
          metrics: {
            totalProcessingTime: Date.now() - metrics.startTime,
            totalMessages: metrics.totalMessages,
            successfulMessages: metrics.successfulMessages,
            failedMessages: metrics.failedMessages
          }
        });
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
          await processMessage(fullMessageResponse.data, org.id);
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

async function processMessage(message: gmail_v1.Schema$Message, orgId: string) {
  if (!message || !message.payload) {
    throw new Error('Invalid message data');
  }

  // Extract email details
  const headers = message.payload.headers || [];
  const subject = headers.find((h: Schema$MessagePartHeader) => h.name === 'Subject')?.value || '';
  const from = headers.find((h: Schema$MessagePartHeader) => h.name === 'From')?.value || '';
  const to = headers.find((h: Schema$MessagePartHeader) => h.name === 'To')?.value || '';
  const threadId = message.threadId;
  const messageId = headers.find((h: Schema$MessagePartHeader) => h.name === 'Message-ID')?.value || '';
  const references = headers.find((h: Schema$MessagePartHeader) => h.name === 'References')?.value || '';
  const inReplyTo = headers.find((h: Schema$MessagePartHeader) => h.name === 'In-Reply-To')?.value || '';

  await logger.info('Processing message', {
    messageId: message.id,
    subject,
    threadId,
    from,
    to
  });

  if (!threadId) {
    throw new Error('Message missing thread ID');
  }

  // Get HTML body
  const htmlBody = await getEmailBody(message);

  // Find matching ticket by thread_id
  const { data: existingTicket } = await supabase
    .from('tickets')
    .select('id')
    .eq('metadata->thread_id', threadId)
    .single();

  let ticketId: string;

  if (existingTicket) {
    ticketId = existingTicket.id;
    await logger.info('Found existing ticket', {
      ticketId,
      threadId,
      messageId: message.id
    });
  } else {
    // Create new ticket if thread not found
    const { data: newTicket, error: ticketError } = await supabase
      .from('tickets')
      .insert({
        subject,
        description: message.snippet || '',
        status: 'open',
        priority: 'medium',
        customer_id: orgId,
        metadata: {
          thread_id: threadId,
          message_id: messageId || null,
        },
        org_id: orgId,
      })
      .select()
      .single();

    if (ticketError || !newTicket) {
      throw new Error('Failed to create ticket');
    }

    ticketId = newTicket.id;
    await logger.info('Created new ticket', {
      ticketId,
      threadId,
      messageId: message.id
    });
  }

  // Check if this email is already stored
  const { data: existingEmail } = await supabase
    .from('ticket_email_chats')
    .select('id')
    .eq('message_id', message.id || '')
    .single();

  if (existingEmail) {
    await logger.info('Email already processed', {
      messageId: message.id,
      ticketId
    });
    return;
  }

  // Store in ticket_email_chats
  const { error: chatError } = await supabase
    .from('ticket_email_chats')
    .insert({
      ticket_id: ticketId,
      message_id: message.id || '',
      thread_id: threadId,
      from_address: from,
      to_address: [to],
      subject,
      body: htmlBody,
      attachments: [],
      gmail_date: new Date(parseInt(message.internalDate || '0')).toISOString(),
      org_id: orgId,
      metadata: {
        message_id: messageId,
        references,
        in_reply_to: inReplyTo,
      },
    });

  if (chatError) {
    throw new Error('Failed to store email');
  }

  await logger.info('Successfully processed message', {
    messageId: message.id,
    threadId,
    ticketId
  });
} 