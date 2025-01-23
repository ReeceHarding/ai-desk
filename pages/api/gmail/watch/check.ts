import { createClient } from '@supabase/supabase-js';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { NextApiRequest, NextApiResponse } from 'next';
import { Database } from '../../../../types/supabase';

const oauth2Client = new OAuth2Client(
  process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID || '',
  process.env.GMAIL_CLIENT_SECRET || '',
  process.env.NEXT_PUBLIC_GMAIL_REDIRECT_URI || ''
);

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface WatchResponse {
  historyId: string;
  expiration: string;
  resourceId: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Get expiring watches (within next 24 hours)
    const expirationThreshold = new Date();
    expirationThreshold.setHours(expirationThreshold.getHours() + 24);
    
    // Check organizations
    const { data: expiringOrgs } = await supabase
      .from('organizations')
      .select('id, gmail_refresh_token, gmail_access_token, gmail_watch_expiration')
      .lt('gmail_watch_expiration', expirationThreshold.toISOString())
      .eq('gmail_watch_status', 'active');

    // Check profiles
    const { data: expiringProfiles } = await supabase
      .from('profiles')
      .select('id, gmail_refresh_token, gmail_access_token, gmail_watch_expiration')
      .lt('gmail_watch_expiration', expirationThreshold.toISOString())
      .eq('gmail_watch_status', 'active');

    // Refresh organization watches
    if (expiringOrgs) {
      for (const org of expiringOrgs) {
        if (org.gmail_refresh_token && org.gmail_access_token) {
          try {
            oauth2Client.setCredentials({
              access_token: org.gmail_access_token,
              refresh_token: org.gmail_refresh_token,
            });

            const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
            
            const watchResponse = await gmail.users.watch({
              userId: 'me',
              requestBody: {
                labelIds: ['INBOX'],
                topicName: `projects/${process.env.GOOGLE_PROJECT_ID}/topics/gmail-updates`
              }
            });

            const watchData = watchResponse.data as WatchResponse;
            const expirationDate = new Date(parseInt(watchData.expiration));

            await supabase
              .from('organizations')
              .update({
                gmail_watch_resource_id: watchData.resourceId,
                gmail_watch_expiration: expirationDate.toISOString(),
                gmail_watch_status: 'active'
              })
              .eq('id', org.id);
          } catch (error) {
            console.error(`Error refreshing watch for organization ${org.id}:`, error);
            await supabase
              .from('organizations')
              .update({
                gmail_watch_status: 'failed'
              })
              .eq('id', org.id);
          }
        }
      }
    }

    // Refresh profile watches
    if (expiringProfiles) {
      for (const profile of expiringProfiles) {
        if (profile.gmail_refresh_token && profile.gmail_access_token) {
          try {
            oauth2Client.setCredentials({
              access_token: profile.gmail_access_token,
              refresh_token: profile.gmail_refresh_token,
            });

            const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
            
            const watchResponse = await gmail.users.watch({
              userId: 'me',
              requestBody: {
                labelIds: ['INBOX'],
                topicName: `projects/${process.env.GOOGLE_PROJECT_ID}/topics/gmail-updates`
              }
            });

            const watchData = watchResponse.data as WatchResponse;
            const expirationDate = new Date(parseInt(watchData.expiration));

            await supabase
              .from('profiles')
              .update({
                gmail_watch_resource_id: watchData.resourceId,
                gmail_watch_expiration: expirationDate.toISOString(),
                gmail_watch_status: 'active'
              })
              .eq('id', profile.id);
          } catch (error) {
            console.error(`Error refreshing watch for profile ${profile.id}:`, error);
            await supabase
              .from('profiles')
              .update({
                gmail_watch_status: 'failed'
              })
              .eq('id', profile.id);
          }
        }
      }
    }

    return res.status(200).json({ message: 'Watch refresh check completed' });
  } catch (error) {
    console.error('Error in Gmail watch check API route:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
} 