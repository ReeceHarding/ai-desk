import { NextApiRequest, NextApiResponse } from 'next';
import { GmailTokens } from '../../../types/gmail';
import { getGmailClient } from './utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;

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
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 10
    });

    const messages = response.data.messages || [];
    const fullMessages = [];

    for (const message of messages) {
      const messageResponse = await gmail.users.messages.get({
        userId: 'me',
        id: message.id!,
        format: 'full'
      });

      const messageData = messageResponse.data;
      const headers = messageData.payload?.headers || [];
      const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value;

      fullMessages.push({
        ...messageData,
        from: getHeader('from'),
        to: getHeader('to'),
        subject: getHeader('subject'),
        date: new Date(parseInt(messageData.internalDate!)).toISOString()
      });
    }

    return res.status(200).json({ messages: fullMessages });
  } catch (error: any) {
    console.error('Error fetching last ten emails:', error);
    return res.status(error.code || 500).json({ error: error.message });
  }
} 