import { google } from 'googleapis';
import { NextApiRequest, NextApiResponse } from 'next';
import { GmailTokens } from '@/types/gmail';

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
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const tokens: GmailTokens = req.body.tokens;
    
    if (!tokens) {
      return res.status(400).json({ message: 'Tokens are required' });
    }

    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Get list of unread messages
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread -category:{social promotions}', // Exclude social and promotional emails
      maxResults: 50
    });

    if (!response.data.messages) {
      return res.status(200).json([]);
    }

    // Fetch full message details for each message
    const messages = await Promise.all(
      response.data.messages.map(async (message) => {
        const fullMessage = await gmail.users.messages.get({
          userId: 'me',
          id: message.id!
        });
        return fullMessage.data;
      })
    );

    res.status(200).json(messages);
  } catch (error) {
    console.error('Error in Gmail inbox API:', error);
    res.status(500).json({ message: 'Failed to fetch Gmail inbox' });
  }
} 