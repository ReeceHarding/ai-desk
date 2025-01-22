import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { pollGmailInbox } from '@/utils/gmail';
import { logger } from '@/utils/logger';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PubSubMessage {
  message: {
    data: string;
    messageId: string;
    publishTime: string;
    attributes?: Record<string, string>;
  };
  subscription: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify the request is from Google Cloud Pub/Sub
    const authorization = req.headers.authorization;
    if (!authorization) {
      await logger.error('Missing authorization header in Pub/Sub request');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Parse and validate the Pub/Sub message
    const pubSubMessage: PubSubMessage = req.body;
    if (!pubSubMessage.message?.data) {
      await logger.error('Invalid Pub/Sub message format', { body: req.body });
      return res.status(400).json({ error: 'Invalid message format' });
    }

    // Decode the base64 data
    const data = JSON.parse(Buffer.from(pubSubMessage.message.data, 'base64').toString());
    await logger.info('Received Gmail notification', { 
      emailHistoryId: data.historyId,
      messagePublishTime: pubSubMessage.message.publishTime 
    });

    // Get all users/orgs with Gmail integration
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, gmail_access_token, gmail_refresh_token')
      .not('gmail_refresh_token', 'is', null);

    if (profileError) {
      await logger.error('Error fetching profiles with Gmail tokens', { error: profileError });
      throw profileError;
    }

    // Process each mailbox that has Gmail integration
    const processPromises = profiles.map(async (profile) => {
      try {
        if (profile.gmail_refresh_token && profile.gmail_access_token) {
          await pollGmailInbox({
            refresh_token: profile.gmail_refresh_token,
            access_token: profile.gmail_access_token,
            token_type: 'Bearer',
            scope: 'https://www.googleapis.com/auth/gmail.modify',
            expiry_date: 0 // Will force token refresh if needed
          });
        }
      } catch (error) {
        await logger.error(`Error processing mailbox for profile ${profile.id}`, { error });
      }
    });

    // Wait for all mailboxes to be processed
    await Promise.all(processPromises);
    
    // Acknowledge the message
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    await logger.error('Error processing Pub/Sub notification', { error });
    // Return 200 even on error to acknowledge the message
    // This prevents Pub/Sub from retrying failed messages
    res.status(200).json({ status: 'error', message: String(error) });
  }
} 