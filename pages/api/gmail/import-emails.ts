import { logger } from '@/utils/logger';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import type { NextApiRequest, NextApiResponse } from 'next';

// Use service role client for reliability
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { organizationId, pageToken, maxResults = 10 } = req.body;

  if (!organizationId) {
    logger.error('[GMAIL_IMPORT] Missing organizationId');
    return res.status(400).json({ error: 'Missing organizationId' });
  }

  // Validate maxResults
  const validatedMaxResults = Math.min(Math.max(1, Number(maxResults)), 100);

  try {
    // Get organization details with error handling
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('gmail_refresh_token, gmail_access_token, id, owner_id')
      .eq('id', organizationId)
      .single();

    if (orgError) {
      logger.error('[GMAIL_IMPORT] Error fetching organization:', { error: orgError, organizationId });
      return res.status(404).json({ error: 'Organization not found' });
    }

    if (!org.gmail_refresh_token || !org.gmail_access_token || !org.owner_id) {
      logger.error('[GMAIL_IMPORT] Missing Gmail tokens or owner:', { organizationId });
      return res.status(400).json({ error: 'Gmail not connected or missing owner' });
    }

    // Set up Gmail client with error handling
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        `${process.env.NEXT_PUBLIC_SITE_URL}/api/integrations/gmail/callback`
      );

      oauth2Client.setCredentials({
        refresh_token: org.gmail_refresh_token,
        access_token: org.gmail_access_token
      });

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      // Get email threads with retries and pagination
      let retryCount = 0;
      let threads: any[] = [];
      let nextPageToken: string | undefined;
      
      while (retryCount < 3) {
        try {
          const response = await gmail.users.threads.list({
            userId: 'me',
            maxResults: validatedMaxResults,
            pageToken: pageToken
          });
          threads = response.data.threads || [];
          nextPageToken = response.data.nextPageToken || undefined;
          break;
        } catch (error) {
          retryCount++;
          if (retryCount === 3) {
            logger.error('[GMAIL_IMPORT] Failed to fetch threads after 3 retries:', { error, organizationId });
            throw error;
          }
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }

      if (!threads?.length) {
        logger.info('[GMAIL_IMPORT] No threads found for import');
        return res.status(200).json({ tickets: [], nextPageToken });
      }

      // Get full thread details and create tickets
      const tickets = await Promise.all(threads.map(async (thread) => {
        // Check if ticket already exists for this thread
        const { data: existingTicket } = await supabase
          .from('tickets')
          .select('id')
          .eq('org_id', organizationId)
          .contains('metadata', { gmail_thread_id: thread.id })
          .single();

        if (existingTicket) {
          logger.info('[GMAIL_IMPORT] Ticket already exists for thread:', { threadId: thread.id });
          return null;
        }

        // Get full thread with all messages
        const { data: fullThread } = await gmail.users.threads.get({
          userId: 'me',
          id: thread.id!,
          format: 'full'
        });

        if (!fullThread.messages?.length) {
          return null;
        }

        // Get the first message (original email)
        const firstMessage = fullThread.messages[0];
        const headers = firstMessage.payload?.headers;
        const subject = headers?.find(h => h.name === 'Subject')?.value || 'No Subject';
        const from = headers?.find(h => h.name === 'From')?.value || '';
        const to = headers?.find(h => h.name === 'To')?.value || '';
        const date = new Date(parseInt(firstMessage.internalDate || '0')).toISOString();

        // Get email body content
        const getBody = (message: any) => {
          const parts = message.payload.parts || [message.payload];
          let body = '';
          
          for (const part of parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
              body += Buffer.from(part.body.data, 'base64').toString('utf8');
            } else if (part.parts) {
              body += getBody({ payload: { parts: part.parts } });
            }
          }

          return body;
        };

        const content = getBody(firstMessage);

        // Get attachments
        const getAttachments = async (message: any) => {
          const attachments: any[] = [];
          const parts = message.payload.parts || [];

          for (const part of parts) {
            if (part.filename && part.body?.attachmentId) {
              const { data: attachment } = await gmail.users.messages.attachments.get({
                userId: 'me',
                messageId: message.id,
                id: part.body.attachmentId
              });

              if (attachment.data) {
                attachments.push({
                  filename: part.filename,
                  mimeType: part.mimeType,
                  size: part.body.size,
                  data: attachment.data
                });
              }
            }
          }

          return attachments;
        };

        const attachments = await getAttachments(firstMessage);

        // Create ticket
        const { data: ticket, error: ticketError } = await supabase
          .from('tickets')
          .insert({
            subject,
            description: content,
            status: 'pending',
            priority: 'medium',
            customer_id: org.owner_id,
            org_id: organizationId,
            metadata: {
              gmail_thread_id: thread.id,
              gmail_history_id: fullThread.historyId,
              from,
              to,
              date,
              message_count: fullThread.messages.length,
              attachments: attachments.map(a => ({
                filename: a.filename,
                mimeType: a.mimeType,
                size: a.size
              }))
            }
          })
          .select()
          .single();

        if (ticketError) {
          logger.error('[GMAIL_IMPORT] Error creating ticket:', { 
            error: ticketError,
            subject,
            threadId: thread.id,
            userId: org.owner_id,
            orgId: organizationId
          });
          throw ticketError;
        }

        // Create email chats for each message in thread
        await Promise.all(fullThread.messages.map(async (message) => {
          const headers = message.payload?.headers;
          const from = headers?.find(h => h.name === 'From')?.value || '';
          const to = headers?.find(h => h.name === 'To')?.value || '';
          const cc = headers?.find(h => h.name === 'Cc')?.value?.split(',').map(e => e.trim()) || [];
          const bcc = headers?.find(h => h.name === 'Bcc')?.value?.split(',').map(e => e.trim()) || [];
          const date = new Date(parseInt(message.internalDate || '0')).toISOString();
          const content = getBody(message);
          const attachments = await getAttachments(message);

          const { error: chatError } = await supabase
            .from('ticket_email_chats')
            .insert({
              ticket_id: ticket.id,
              message_id: message.id,
              thread_id: thread.id,
              from_address: from,
              to_address: to.split(',').map(e => e.trim()),
              cc_address: cc,
              bcc_address: bcc,
              subject,
              body: content,
              attachments: attachments.map(a => ({
                filename: a.filename,
                mimeType: a.mimeType,
                size: a.size,
                data: a.data
              })),
              gmail_date: date,
              org_id: organizationId
            });

          if (chatError) {
            logger.error('[GMAIL_IMPORT] Error creating email chat:', { error: chatError });
            throw chatError;
          }
        }));

        return ticket;
      }));

      const validTickets = tickets.filter(t => t !== null);
      return res.status(200).json({ tickets: validTickets, nextPageToken });
    } catch (error) {
      logger.error('[GMAIL_IMPORT] Error setting up Gmail client:', { error });
      return res.status(500).json({ error: 'Failed to set up Gmail client' });
    }
  } catch (error) {
    logger.error('[GMAIL_IMPORT] Error importing emails:', { error });
    return res.status(500).json({ error: 'Failed to import emails' });
  }
} 
