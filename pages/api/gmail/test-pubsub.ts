import { logger } from '@/utils/logger';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await logger.info('Simulating PubSub notification');

    // Create a PubSub-like notification
    const message = {
      message: {
        data: Buffer.from(JSON.stringify({
          emailAddress: 'rieboysspam@gmail.com',
          historyId: '2180413'
        })).toString('base64'),
        messageId: 'test-message-id',
        publishTime: new Date().toISOString()
      },
      subscription: 'projects/zendesk-clone-448507/subscriptions/gmail-updates-sub'
    };

    // Forward to webhook
    const webhookResponse = await fetch('http://localhost:3000/api/gmail/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message)
    });

    const webhookResult = await webhookResponse.json();

    await logger.info('Webhook response', { webhookResult });

    return res.status(200).json({
      message: 'PubSub notification simulated',
      webhookResult
    });
  } catch (error) {
    await logger.error('Error simulating PubSub notification', { error });
    return res.status(500).json({ message: 'Failed to simulate PubSub notification' });
  }
} 