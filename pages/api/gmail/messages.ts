import { OAuth2Client } from 'google-auth-library';
import { gmail_v1, google } from 'googleapis';
import { NextApiRequest, NextApiResponse } from 'next';
import { GmailMessage } from '../../../types/gmail';

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
    const { access_token, refresh_token } = req.body;

    if (!access_token || !refresh_token) {
      return res.status(400).json({ message: 'Missing required tokens' });
    }

    oauth2Client.setCredentials({
      access_token,
      refresh_token,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Get list of messages
    const { data: messagesList } = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 10,
    });

    if (!messagesList.messages || messagesList.messages.length === 0) {
      return res.json([]);
    }

    // Get full message details
    const messages = await Promise.all(
      messagesList.messages.map(async ({ id }) => {
        try {
          const { data: message } = await gmail.users.messages.get({
            userId: 'me',
            id: id!,
            format: 'full',
          });

          const headers = message.payload?.headers || [];
          const getHeader = (name: string) =>
            headers.find((h: gmail_v1.Schema$MessagePartHeader) => h.name?.toLowerCase() === name.toLowerCase())?.value;

          const body = message.payload ? extractBody(message.payload) : '';

          const parsedMessage: GmailMessage = {
            id: message.id!,
            threadId: message.threadId!,
            labelIds: message.labelIds || [],
            subject: getHeader('subject') || '(No Subject)',
            from: getHeader('from') || '',
            to: getHeader('to') || '',
            date: message.internalDate!,
            body: {
              text: body || '',
              html: body || '',
            },
            snippet: message.snippet || '',
            labels: message.labelIds || [],
            attachments: [],
          };

          return parsedMessage;
        } catch (error) {
          console.error(`Error processing message ${id}:`, error);
          return null;
        }
      })
    );

    const validMessages = messages.filter((msg): msg is GmailMessage => msg !== null);
    return res.json(validMessages);
  } catch (error) {
    console.error('Error in Gmail messages API route:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
} 