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
    const { access_token, refresh_token, type, id } = req.body;

    if (!access_token || !refresh_token || !type || !id) {
      return res.status(400).json({ message: 'Missing required parameters' });
    }

    oauth2Client.setCredentials({
      access_token,
      refresh_token,
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

    // Update the database with watch information
    if (type === 'organization') {
      await supabase
        .from('organizations')
        .update({
          gmail_watch_resource_id: watchData.resourceId,
          gmail_watch_expiration: expirationDate.toISOString(),
          gmail_watch_status: 'active'
        })
        .eq('id', id);
    } else {
      await supabase
        .from('profiles')
        .update({
          gmail_watch_resource_id: watchData.resourceId,
          gmail_watch_expiration: expirationDate.toISOString(),
          gmail_watch_status: 'active'
        })
        .eq('id', id);
    }

    return res.json(watchData);
  } catch (error) {
    console.error('Error in Gmail watch API route:', error);
    
    // Update status to failed
    const table = req.body.type === 'organization' ? 'organizations' : 'profiles';
    await supabase
      .from(table)
      .update({
        gmail_watch_status: 'failed'
      })
      .eq('id', req.body.id);

    return res.status(500).json({ message: 'Internal server error' });
  }
} 