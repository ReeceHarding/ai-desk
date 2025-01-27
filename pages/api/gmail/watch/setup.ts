import { Database } from '@/types/supabase';
import { logger } from '@/utils/logger';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { NextApiRequest, NextApiResponse } from 'next';

// Configure Gmail API
const gmail = google.gmail({ version: 'v1' });

// Gmail Watch Response type
interface WatchResponse {
  historyId: string;
  expiration: string;
  resourceId?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, id, refresh_token } = req.body;
  const accessToken = req.headers.authorization?.split(' ')[1];

  if (!accessToken || !refresh_token || !type || !id) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.NEXT_PUBLIC_GMAIL_REDIRECT_URI
    );

    // Set credentials
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refresh_token
    });

    // Set up Gmail push notifications
    const watchResponse = await gmail.users.watch({
      userId: 'me',
      auth: oauth2Client,
      requestBody: {
        labelIds: ['INBOX'],
        topicName: `projects/${process.env.GOOGLE_PROJECT_ID}/topics/gmail-notifications`,
        labelFilterAction: 'include'
      }
    });

    const watchData = watchResponse.data as WatchResponse;

    if (!watchData.historyId || !watchData.expiration) {
      throw new Error('Invalid watch response from Gmail API');
    }

    // Initialize Supabase client
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Update watch details in database
    if (type === 'profile') {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          gmail_watch_status: 'active',
          gmail_watch_expiration: new Date(Number(watchData.expiration)).toISOString(),
          gmail_watch_resource_id: watchData.resourceId,
          gmail_history_id: watchData.historyId,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) {
        logger.error('[GMAIL_WATCH] Error updating profile watch details:', updateError);
        throw updateError;
      }
    } else if (type === 'organization') {
      const { error: updateError } = await supabase
        .from('organizations')
        .update({
          gmail_watch_status: 'active',
          gmail_watch_expiration: new Date(Number(watchData.expiration)).toISOString(),
          gmail_watch_resource_id: watchData.resourceId,
          gmail_history_id: watchData.historyId,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) {
        logger.error('[GMAIL_WATCH] Error updating organization watch details:', updateError);
        throw updateError;
      }
    }

    logger.info('[GMAIL_WATCH] Successfully set up watch', {
      type,
      id,
      resourceId: watchData.resourceId,
      expiration: watchData.expiration
    });

    return res.status(200).json({
      resourceId: watchData.resourceId,
      expiration: watchData.expiration,
      historyId: watchData.historyId
    });
  } catch (error) {
    logger.error('[GMAIL_WATCH] Error setting up watch:', error);
    return res.status(500).json({ error: 'Failed to set up Gmail watch' });
  }
} 