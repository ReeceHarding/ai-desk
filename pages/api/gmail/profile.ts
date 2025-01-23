import { createClient } from '@supabase/supabase-js';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import { NextApiRequest, NextApiResponse } from 'next';
import { GmailProfile } from '../../../types/gmail';

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
    const { org_id } = req.body;

    if (!org_id) {
      return res.status(400).json({ message: 'Missing organization ID' });
    }

    // Get tokens from organizations table
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('gmail_access_token, gmail_refresh_token')
      .eq('id', org_id)
      .single();

    if (orgError || !org) {
      console.error('Error getting organization tokens:', orgError);
      return res.status(404).json({ message: 'Organization not found or missing Gmail tokens' });
    }

    const { gmail_access_token, gmail_refresh_token } = org;

    if (!gmail_access_token || !gmail_refresh_token) {
      return res.status(400).json({ message: 'Missing required tokens' });
    }

    oauth2Client.setCredentials({
      access_token: gmail_access_token,
      refresh_token: gmail_refresh_token,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const { data: profile } = await gmail.users.getProfile({
      userId: 'me',
    });

    const gmailProfile: GmailProfile = {
      emailAddress: profile.emailAddress || '',
      messagesTotal: profile.messagesTotal || 0,
      threadsTotal: profile.threadsTotal || 0,
      historyId: profile.historyId || '',
    };

    return res.json(gmailProfile);
  } catch (error) {
    console.error('Error in Gmail profile API route:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
} 