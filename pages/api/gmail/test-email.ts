import { logger } from '@/utils/logger';
import { createClient } from '@supabase/supabase-js';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const oauth2Client = new OAuth2Client(
  process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.NEXT_PUBLIC_GMAIL_REDIRECT_URI
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Get organization with Gmail tokens
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, gmail_access_token, gmail_refresh_token')
      .not('gmail_refresh_token', 'is', null)
      .single();

    if (orgError || !org) {
      await logger.error('Failed to get organization', { error: orgError });
      return res.status(404).json({ message: 'Organization not found or missing Gmail tokens' });
    }

    oauth2Client.setCredentials({
      access_token: org.gmail_access_token,
      refresh_token: org.gmail_refresh_token,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Create the email message
    const message = [
      'From: me',
      'To: rieboysspam@gmail.com',
      'Subject: Test Email for Webhook',
      '',
      'This is a test email to verify the Gmail webhook functionality.',
      '',
      'Best regards,',
      'Your Ticketing System'
    ].join('\n');

    // Encode the message
    const encodedMessage = Buffer.from(message).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send the email
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    await logger.info('Test email sent', {
      messageId: response.data.id,
      threadId: response.data.threadId,
    });

    return res.status(200).json({
      message: 'Test email sent successfully',
      messageId: response.data.id,
      threadId: response.data.threadId,
    });
  } catch (error) {
    await logger.error('Error sending test email', { error });
    return res.status(500).json({ message: 'Failed to send test email' });
  }
} 