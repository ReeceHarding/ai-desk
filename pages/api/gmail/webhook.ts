import { Database } from '@/types/supabase';
import { logger } from '@/utils/logger';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { gmail_v1, google } from 'googleapis';
import { NextApiRequest, NextApiResponse } from 'next';

type Schema$MessagePartHeader = gmail_v1.Schema$MessagePartHeader;

interface MessageHeader {
  name: string;
  value: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify the request is from Google
    // In production, you should verify X-Goog-Channel-ID and X-Goog-Channel-Token
    const messageData = req.body;

    // Get all organizations with Gmail integration
    const supabase = createServerSupabaseClient<Database>({ req, res });
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id, gmail_access_token, gmail_refresh_token')
      .not('gmail_refresh_token', 'is', null);

    if (orgsError) {
      await logger.error('Failed to fetch organizations', { error: orgsError });
      return res.status(500).json({ error: 'Internal server error' });
    }

    // Process each organization's Gmail
    for (const org of orgs) {
      try {
        const oauth2Client = new google.auth.OAuth2(
          process.env.GMAIL_CLIENT_ID,
          process.env.GMAIL_CLIENT_SECRET,
          process.env.GMAIL_REDIRECT_URI
        );

        oauth2Client.setCredentials({
          access_token: org.gmail_access_token,
          refresh_token: org.gmail_refresh_token,
        });

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // Get latest messages
        const messagesResponse = await gmail.users.messages.list({
          userId: 'me',
          q: 'newer_than:1h', // Only get recent messages
        });

        const messages = messagesResponse.data.messages;
        if (!messages) continue;

        // Process each message
        for (const message of messages) {
          if (!message.id) continue;

          const fullMessageResponse = await gmail.users.messages.get({
            userId: 'me',
            id: message.id,
          });

          const fullMessage = fullMessageResponse.data;
          if (!fullMessage || !fullMessage.payload) continue;

          // Extract email details
          const headers = fullMessage.payload.headers || [];
          const subject = headers.find((h: Schema$MessagePartHeader) => h.name === 'Subject')?.value || '';
          const from = headers.find((h: Schema$MessagePartHeader) => h.name === 'From')?.value || '';
          const to = headers.find((h: Schema$MessagePartHeader) => h.name === 'To')?.value || '';
          const threadId = fullMessage.threadId;

          if (!threadId) continue;

          // Find matching ticket by thread_id
          const { data: ticket } = await supabase
            .from('tickets')
            .select('id')
            .eq('metadata->thread_id', threadId)
            .single();

          if (!ticket) continue;

          // Store in ticket_email_chats
          const { error: chatError } = await supabase
            .from('ticket_email_chats')
            .insert({
              ticket_id: ticket.id,
              message_id: fullMessage.id || '',
              thread_id: threadId,
              from_address: from,
              to_address: [to],
              subject,
              body: fullMessage.snippet || '',
              attachments: [],
              gmail_date: new Date(parseInt(fullMessage.internalDate || '0')).toISOString(),
              org_id: org.id,
            });

          if (chatError) {
            await logger.error('Failed to store email', { error: chatError });
          }
        }
      } catch (error) {
        await logger.error('Error processing organization emails', { error, orgId: org.id });
      }
    }

    return res.status(200).json({ status: 'success' });
  } catch (error) {
    await logger.error('Webhook processing error', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
} 