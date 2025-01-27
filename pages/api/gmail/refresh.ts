import { google } from 'googleapis';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      refresh_token
    });

    const { credentials } = await oauth2Client.refreshAccessToken();

    return res.status(200).json({
      access_token: credentials.access_token,
      refresh_token: refresh_token,
      expiry_date: credentials.expiry_date
    });
  } catch (error: any) {
    console.error('Error refreshing Gmail tokens:', error);
    return res.status(error.code || 500).json({ error: error.message });
  }
} 