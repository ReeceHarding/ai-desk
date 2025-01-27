import { NextApiRequest, NextApiResponse } from 'next';
import { GmailTokens } from '../../../types/gmail';
import { getGmailClient } from './utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messageId } = req.query;
    const authHeader = req.headers.authorization;

    if (!messageId) {
      return res.status(400).json({ error: 'Message ID is required' });
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const access_token = authHeader.split(' ')[1];
    const tokens: GmailTokens = {
      access_token,
      refresh_token: '', // Not needed for this request
      expiry_date: Date.now() + 3600000 // Default 1 hour
    };

    const gmail = await getGmailClient(tokens);
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId as string,
      format: 'full'
    });

    const message = response.data;
    let content = '';

    // Extract content from message payload
    if (message.payload) {
      const extractContent = (part: any): string => {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString();
        }
        if (part.parts) {
          return part.parts.map(extractContent).join('\n');
        }
        return '';
      };

      content = extractContent(message.payload);
    }

    if (!content && message.snippet) {
      content = message.snippet;
    }

    return res.status(200).json({ content });
  } catch (error: any) {
    console.error('Error fetching Gmail message content:', error);
    return res.status(error.code || 500).json({ error: error.message });
  }
} 