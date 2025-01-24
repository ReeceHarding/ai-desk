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
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      await logger.info('Processing message attempt', {
        messageId: message.id,
        orgId,
        attempt: retryCount + 1
      });

      if (!message || !message.payload) {
        throw new Error('Invalid message data');
      }

      // Extract email details
      const headers = message.payload.headers || [];
      const subject = headers.find((h: Schema$MessagePartHeader) => h.name === 'Subject')?.value || '';
      const from = headers.find((h: Schema$MessagePartHeader) => h.name === 'From')?.value || '';
      const to = headers.find((h: Schema$MessagePartHeader) => h.name === 'To')?.value || '';
      const threadId = message.threadId;

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

      // Extract sender's email and name
      const fromMatch = from.match(/(?:"?([^"]*)"?\s*)?(?:<?(.+@[^>]+)>?)/);
      const senderName = fromMatch?.[1] || '';
      const senderEmail = fromMatch?.[2] || '';

      if (!senderEmail) {
        throw new Error('Could not extract sender email');
      }

      await logger.info('Extracted sender details', {
        senderName,
        senderEmail
      });

      // Find or create customer
      let customerId: string;
      const { data: existingCustomer, error: customerLookupError } = await supabase
        .from('customers')
        .select('id')
        .eq('email', senderEmail)
        .eq('org_id', orgId)
        .single();

      if (customerLookupError && customerLookupError.code !== 'PGRST116') {
        throw new Error(`Failed to lookup customer: ${customerLookupError.message}`);
      }

      if (existingCustomer) {
        customerId = existingCustomer.id;
        await logger.info('Found existing customer', {
          customerId,
          email: senderEmail
        });
      } else {
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            name: senderName || senderEmail,
            email: senderEmail,
            org_id: orgId,
          })
          .select()
          .single();

        if (customerError) {
          throw new Error(`Failed to create customer: ${customerError.message}`);
        }

        if (!newCustomer) {
          throw new Error('Customer creation returned no data');
        }

        customerId = newCustomer.id;
        await logger.info('Created new customer', {
          customerId,
          email: senderEmail
        });
      }

      // Get HTML body
      const htmlBody = await getEmailBody(message);

      // Find matching ticket by thread_id
      const { data: existingTicket, error: ticketLookupError } = await supabase
        .from('tickets')
        .select('id')
        .eq('metadata->thread_id', threadId)
        .single();

      if (ticketLookupError && ticketLookupError.code !== 'PGRST116') {
        throw new Error(`Failed to lookup ticket: ${ticketLookupError.message}`);
      }

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
            customer_id: customerId,
            metadata: {
              thread_id: threadId,
              message_id: message.id || null,
            },
            org_id: orgId,
          })
          .select()
          .single();

        if (ticketError) {
          throw new Error(`Failed to create ticket: ${ticketError.message}`);
        }

        if (!newTicket) {
          throw new Error('Ticket creation returned no data');
        }

        ticketId = newTicket.id;
        await logger.info('Created new ticket', {
          ticketId,
          threadId,
          messageId: message.id
        });
      }

      // Store email in ticket_email_chats
      const { error: emailError } = await supabase
        .from('ticket_email_chats')
        .insert({
          ticket_id: ticketId,
          content: htmlBody,
          metadata: {
            message_id: message.id,
            thread_id: threadId,
            from,
            to,
            subject
          },
          type: 'email'
        });

      if (emailError) {
        throw new Error(`Failed to store email: ${emailError.message}`);
      }

      await logger.info('Stored email successfully', {
        ticketId,
        messageId: message.id
      });

      // If successful, break the retry loop
      break;
    } catch (error) {
      retryCount++;
      
      await logger.error('Failed to process message', {
        error,
        messageId: message.id,
        orgId,
        attempt: retryCount,
        maxRetries
      });

      if (retryCount === maxRetries) {
        throw error;
      }

      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
    }
  }
} 