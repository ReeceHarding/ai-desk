import { google } from 'googleapis';
import { NextApiRequest, NextApiResponse } from 'next';

// Configure Gmail API to use HTTP/1.1
google.options({
  http2: false
});

const oauth2Client = new google.auth.OAuth2(
  process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.NEXT_PUBLIC_GMAIL_REDIRECT_URI
);

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

    // Generate the url that will be used for the consent dialog.
    const authorizeUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
      ],
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