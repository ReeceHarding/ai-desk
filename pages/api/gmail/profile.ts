import { NextApiRequest, NextApiResponse } from 'next';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { GmailProfile } from '../../../types/gmail';

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
    const { access_token, refresh_token } = req.body;

    if (!access_token || !refresh_token) {
      return res.status(400).json({ message: 'Missing required tokens' });
    }

    oauth2Client.setCredentials({
      access_token,
      refresh_token,
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