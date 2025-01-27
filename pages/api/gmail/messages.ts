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

    return res.status(200).json({ messages: response.data.messages || [] });
  } catch (error: any) {
    console.error('Error fetching Gmail messages:', error);
    return res.status(error.code || 500).json({ error: error.message });
  }
} 