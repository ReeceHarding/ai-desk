import { createServerOAuth2Client, GMAIL_SCOPES } from '@/utils/gmail-server-config';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, id } = req.body;

    if (!type || !id) {
      return res.status(400).json({ error: 'Missing type or id in request body' });
    }

    if (!['organization', 'profile'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Must be either "organization" or "profile"' });
    }

    // Generate state parameter with type and id
    const state = `${type}:${id}`;

    console.log('Using OAuth2 config:', {
      clientId: process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID,
      redirectUri: process.env.NEXT_PUBLIC_GMAIL_REDIRECT_URI,
      state
    });

    const oauth2Client = createServerOAuth2Client();

    // Generate the url that will be used for the consent dialog.
    const authorizeUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: GMAIL_SCOPES,
      state,
      prompt: 'consent',
    });

    console.log('Generated auth URL:', authorizeUrl);
    res.status(200).json({ url: authorizeUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
} 