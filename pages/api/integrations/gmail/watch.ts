import { NextApiRequest, NextApiResponse } from 'next';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/utils/logger';

const oauth2Client = new OAuth2Client(
  process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.NEXT_PUBLIC_GMAIL_REDIRECT_URI
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { profile_id } = req.body;
    if (!profile_id) {
      return res.status(400).json({ error: 'Profile ID is required' });
    }

    // Get profile's Gmail tokens
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('gmail_access_token, gmail_refresh_token')
      .eq('id', profile_id)
      .single();

    if (profileError || !profile) {
      await logger.error('Error fetching profile', { error: profileError });
      return res.status(404).json({ error: 'Profile not found' });
    }

    if (!profile.gmail_refresh_token || !profile.gmail_access_token) {
      return res.status(400).json({ error: 'Gmail not connected for this profile' });
    }

    // Set up OAuth client
    oauth2Client.setCredentials({
      access_token: profile.gmail_access_token,
      refresh_token: profile.gmail_refresh_token,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Set up watch
    const watchResponse = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName: `projects/${process.env.GOOGLE_CLOUD_PROJECT}/topics/gmail-updates`,
        labelIds: [], // Empty array means watch all labels except SPAM and TRASH
      },
    });

    if (!watchResponse.data.expiration) {
      throw new Error('Watch response missing expiration');
    }

    // Store watch expiration
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        gmail_watch_expiration: new Date(parseInt(watchResponse.data.expiration)).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile_id);

    if (updateError) {
      await logger.error('Error updating watch expiration', { error: updateError });
      throw updateError;
    }

    await logger.info('Gmail watch registered successfully', {
      profile_id,
      historyId: watchResponse.data.historyId,
      expiration: watchResponse.data.expiration,
    });

    res.status(200).json({
      status: 'success',
      expiration: watchResponse.data.expiration,
      historyId: watchResponse.data.historyId,
    });
  } catch (error) {
    await logger.error('Error setting up Gmail watch', { error });
    res.status(500).json({ error: String(error) });
  }
} 