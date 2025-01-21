import { google } from 'googleapis';
import { NextApiRequest, NextApiResponse } from 'next';
import { GmailTokens } from '@/types/gmail';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { tokens, messageId, labelName }: {
      tokens: GmailTokens;
      messageId: string;
      labelName: string;
    } = req.body;
    
    if (!tokens || !messageId || !labelName) {
      return res.status(400).json({ message: 'Tokens, messageId, and labelName are required' });
    }

    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // First check if label exists
    const labels = await gmail.users.labels.list({ userId: 'me' });
    let label = labels.data.labels?.find((l) => l.name === labelName);

    // Create label if it doesn't exist
    if (!label) {
      const newLabel = await gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name: labelName,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show'
        }
      });
      label = newLabel.data;
    }

    // Add label to message
    if (label.id) {
      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: [label.id]
        }
      });
    }

    res.status(200).json({ message: 'Label added successfully' });
  } catch (error) {
    console.error('Error in Gmail label API:', error);
    res.status(500).json({ message: 'Failed to add Gmail label' });
  }
} 