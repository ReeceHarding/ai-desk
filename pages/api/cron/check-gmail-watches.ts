import { Database } from '@/types/supabase';
import { logger } from '@/utils/logger';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { NextApiRequest, NextApiResponse } from 'next';

// Initialize Supabase client
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAndRefreshWatch(
  profile: { 
    id: string; 
    gmail_access_token: string; 
    gmail_refresh_token: string;
    gmail_watch_expiration: string | null;
  }
) {
  try {
    // Set up Gmail OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: profile.gmail_access_token,
      refresh_token: profile.gmail_refresh_token,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Check if watch needs refresh (expired or expires in next hour)
    const now = new Date();
    const expirationDate = profile.gmail_watch_expiration ? new Date(profile.gmail_watch_expiration) : null;
    const needsRefresh = !expirationDate || expirationDate.getTime() - now.getTime() < 60 * 60 * 1000;

    if (needsRefresh) {
      await logger.info('Refreshing Gmail watch', { userId: profile.id });

      // Set up push notifications
      const watchResponse = await gmail.users.watch({
        userId: 'me',
        requestBody: {
          labelIds: ['INBOX'],
          topicName: `projects/${process.env.GOOGLE_CLOUD_PROJECT}/topics/${process.env.GMAIL_PUBSUB_TOPIC}`,
        },
      });

      if (!watchResponse.data) {
        throw new Error('Failed to set up Gmail watch');
      }

      // Update profile with new watch details
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          gmail_watch_expiration: new Date(Number(watchResponse.data.expiration)).toISOString(),
          gmail_watch_history_id: watchResponse.data.historyId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (updateError) {
        throw updateError;
      }

      await logger.info('Successfully refreshed Gmail watch', {
        userId: profile.id,
        expiration: watchResponse.data.expiration,
        historyId: watchResponse.data.historyId
      });
    }
  } catch (error) {
    await logger.error('Error refreshing Gmail watch', { error, userId: profile.id });
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify the request is from the cron job
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get all profiles with Gmail integration
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, gmail_access_token, gmail_refresh_token, gmail_watch_expiration')
      .not('gmail_refresh_token', 'is', null);

    if (profilesError) {
      throw profilesError;
    }

    await logger.info('Checking Gmail watches', { profileCount: profiles.length });

    // Process each profile
    for (const profile of profiles) {
      // Skip profiles without required tokens
      if (!profile.gmail_access_token || !profile.gmail_refresh_token) {
        await logger.warn('Skipping profile without Gmail tokens', { userId: profile.id });
        continue;
      }

      await checkAndRefreshWatch({
        id: profile.id,
        gmail_access_token: profile.gmail_access_token,
        gmail_refresh_token: profile.gmail_refresh_token,
        gmail_watch_expiration: profile.gmail_watch_expiration,
      });
    }

    await logger.info('Completed Gmail watch check');
    return res.status(200).json({ status: 'success' });
  } catch (error) {
    await logger.error('Error in check-gmail-watches cron', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
} 