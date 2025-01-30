import dotenv from 'dotenv';
import { resolve } from 'path';
import { logger } from '../utils/logger';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

async function main() {
  try {
    await logger.info('Starting PubSub test');

    // Create a PubSub-like notification
    const message = {
      message: {
        data: Buffer.from(JSON.stringify({
          emailAddress: 'reeceharding@gmail.com',
          historyId: '3935083'
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
        'Authorization': `Bearer ${process.env.PUBSUB_SECRET_TOKEN}`
      },
      body: JSON.stringify(message)
    });

    const webhookResult = await webhookResponse.json();
    await logger.info('Webhook response', { webhookResult });

    if (!webhookResponse.ok) {
      throw new Error(`Webhook failed with status ${webhookResponse.status}: ${JSON.stringify(webhookResult)}`);
    }

    await logger.info('PubSub test completed successfully');
    process.exit(0);
  } catch (error) {
    await logger.error('PubSub test failed', { error });
    process.exit(1);
  }
}

main(); 
