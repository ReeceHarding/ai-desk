import { NextApiRequest, NextApiResponse } from 'next';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { gmail_v1 } from 'googleapis';

const oauth2Client = new OAuth2Client(
  process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.NEXT_PUBLIC_GMAIL_REDIRECT_URI
);

const extractBody = (part: gmail_v1.Schema$MessagePart): string | null => {
  if (part.mimeType === 'text/plain' && part.body?.data) {
    return Buffer.from(part.body.data, 'base64').toString();
  }
  if (part.parts) {
    for (const subPart of part.parts) {
      const body = extractBody(subPart);
      if (body) return body;
    }
  }
  return null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { messageId, access_token, refresh_token } = req.body;

    if (!messageId || !access_token || !refresh_token) {
      return res.status(400).json({ message: 'Missing required parameters' });
    }

    oauth2Client.setCredentials({
      access_token,
      refresh_token,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const { data: message } = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    if (!message.payload) {
      return res.json({ content: null });
    }

    const content = extractBody(message.payload);
    return res.json({ content });
  } catch (error) {
    console.error('Error in Gmail content API route:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
} 