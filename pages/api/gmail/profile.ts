import { google } from 'googleapis';
import { NextApiRequest, NextApiResponse } from 'next';
import { GmailTokens } from '@/types/gmail';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const tokens: GmailTokens = req.body.tokens;
    
    if (!tokens) {
      return res.status(400).json({ message: 'Tokens are required' });
    }

    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    const profile = await gmail.users.getProfile({
      userId: 'me'
    });

    res.status(200).json(profile.data);
  } catch (error) {
    console.error('Error in Gmail profile API:', error);
    res.status(500).json({ message: 'Failed to fetch Gmail profile' });
  }
} 