import { NextApiRequest, NextApiResponse } from 'next';
import { OAuth2Client } from 'google-auth-library';

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
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ message: 'Missing refresh token' });
    }

    oauth2Client.setCredentials({
      refresh_token: refresh_token,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();
    
    return res.json({
      access_token: credentials.access_token,
      token_type: credentials.token_type,
      scope: credentials.scope,
      expires_in: credentials.expiry_date ? Math.floor((credentials.expiry_date - Date.now()) / 1000) : 3600,
    });
  } catch (error) {
    console.error('Error in Gmail refresh token API route:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
} 