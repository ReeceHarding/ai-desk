import { NextApiRequest, NextApiResponse } from 'next';
import { GmailTokens } from '../../../types/gmail';
import { getGmailClient } from './utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messageId, labelName } = req.body;
    const authHeader = req.headers.authorization;

    if (!messageId || !labelName) {
      return res.status(400).json({ error: 'Message ID and label name are required' });
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

    // First, check if the label exists
    const { data: labels } = await gmail.users.labels.list({
      userId: 'me'
    });

    let labelId = labels.labels?.find(label => label.name === labelName)?.id;

    // If label doesn't exist, create it
    if (!labelId) {
      const { data: newLabel } = await gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name: labelName,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show'
        }
      });
      labelId = newLabel.id;
    }

    // Add label to message
    const response = await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: [labelId!]
      }
    });

    return res.status(200).json(response.data);
  } catch (error: any) {
    console.error('Error adding Gmail label:', error);
    return res.status(error.code || 500).json({ error: error.message });
  }
} 