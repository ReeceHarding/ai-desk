import { NextApiRequest, NextApiResponse } from 'next';
import { GmailTokens } from '../../../../types/gmail';
import { getGmailClient } from '../utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { resourceId } = req.body;
    const authHeader = req.headers.authorization;

    if (!resourceId) {
      return res.status(400).json({ error: 'Resource ID is required' });
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

    // Stop push notifications
    const response = await gmail.users.stop({
      userId: 'me'
    });

    return res.status(200).json(response.data);
  } catch (error: any) {
    console.error('Error stopping Gmail watch:', error);
    return res.status(error.code || 500).json({ error: error.message });
  }
} 