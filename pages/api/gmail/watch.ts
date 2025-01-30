import { logger } from '@/utils/logger';
import { google } from 'googleapis';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { access_token, refresh_token } = req.body;

    if (!access_token || !refresh_token) {
      return res.status(400).json({ error: 'Missing required tokens' });
    }

    // Set up Gmail client
    const oauth2Client = new google.auth.OAuth2(
      process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.NEXT_PUBLIC_GMAIL_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token,
      refresh_token,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Set up watch
    const response = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        labelIds: [], // Empty array means all labels except SPAM and TRASH
        topicName: process.env.GMAIL_PUBSUB_TOPIC,
        labelFilterAction: 'include'
      }
    });

    if (!response.data.historyId || !response.data.expiration) {
      throw new Error('Invalid watch response');
    }

    await logger.info('Gmail watch setup successful', {
      historyId: response.data.historyId,
      expiration: new Date(Number(response.data.expiration)).toISOString()
    });

    return res.status(200).json({
      historyId: response.data.historyId,
      expiration: response.data.expiration,
      resourceId: response.data.resourceId || ''
    });
  } catch (error) {
    await logger.error('Failed to set up Gmail watch', { error });
    return res.status(500).json({ error: 'Failed to set up Gmail watch' });
  }
} 