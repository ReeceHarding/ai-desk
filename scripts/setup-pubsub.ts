import { PubSub } from '@google-cloud/pubsub';
import crypto from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs';
import { resolve } from 'path';
import { logger } from '../utils/logger';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

// Extract and validate required environment variables
const {
  GOOGLE_CLOUD_PROJECT: projectId,
  GMAIL_PUBSUB_TOPIC = 'projects/zendesk-clone-448507/topics/gmail-updates',
  GMAIL_PUBSUB_SUBSCRIPTION = 'projects/zendesk-clone-448507/subscriptions/gmail-updates-sub',
  PUBSUB_DLQ_TOPIC = 'projects/zendesk-clone-448507/topics/gmail-updates-dlq',
  PUBSUB_PRIMARY_REGION = 'europe-north1',
  PUBSUB_MAX_DELIVERY_ATTEMPTS = '5',
  NEXT_PUBLIC_APP_URL = 'https://4c0c-2600-1700-4c60-6e0-00-3.ngrok-free.app',
  PUBSUB_SECRET_TOKEN
} = process.env;

// Extract topic and subscription names from full paths
const mainTopic = GMAIL_PUBSUB_TOPIC?.split('/').pop();
const mainSubscription = GMAIL_PUBSUB_SUBSCRIPTION?.split('/').pop();
const dlqTopic = PUBSUB_DLQ_TOPIC?.split('/').pop();
const maxDeliveryAttempts = Number(PUBSUB_MAX_DELIVERY_ATTEMPTS);

// Validate required variables
const requiredVars = {
  projectId,
  mainTopic,
  mainSubscription,
  dlqTopic,
  NEXT_PUBLIC_APP_URL
};

const missingVars = Object.entries(requiredVars)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars.join(', '));
  process.exit(1);
}

async function setupPubSub() {
  try {
    const pubsub = new PubSub({ projectId: projectId! });

    await logger.info('Setting up PubSub topics and subscriptions...');

    // Generate a random secret token if not exists
    if (!PUBSUB_SECRET_TOKEN) {
      const secretToken = crypto.randomBytes(32).toString('hex');
      const envPath = resolve(__dirname, '../.env.local');
      
      // Read existing .env.local file
      let envContent = '';
      try {
        envContent = fs.readFileSync(envPath, 'utf8');
      } catch (error) {
        // File doesn't exist, that's okay
      }

      // Add or update PUBSUB_SECRET_TOKEN
      const newLine = `PUBSUB_SECRET_TOKEN=${secretToken}`;
      if (envContent.includes('PUBSUB_SECRET_TOKEN=')) {
        envContent = envContent.replace(/PUBSUB_SECRET_TOKEN=.*\n?/, `${newLine}\n`);
      } else {
        envContent = `${envContent}\n${newLine}\n`;
      }

      // Write back to .env.local
      fs.writeFileSync(envPath, envContent);
      await logger.info('Generated and saved new PUBSUB_SECRET_TOKEN to .env.local:', { secretToken });
    }

    // Create main topic
    const [mainTopicExists] = await pubsub.topic(mainTopic!).exists();
    if (!mainTopicExists) {
      await pubsub.createTopic(mainTopic!);
      await logger.info(`Created topic: ${mainTopic}`);
    } else {
      await logger.info(`Topic ${mainTopic} already exists`);
    }

    // Create DLQ topic
    const [dlqTopicExists] = await pubsub.topic(dlqTopic!).exists();
    if (!dlqTopicExists) {
      await pubsub.createTopic(dlqTopic!);
      await logger.info(`Created DLQ topic: ${dlqTopic}`);
    } else {
      await logger.info(`DLQ topic ${dlqTopic} already exists`);
    }

    // Get topic references
    const mainTopicRef = pubsub.topic(mainTopic!);
    const dlqTopicRef = pubsub.topic(dlqTopic!);

    // Create subscription with DLQ
    const [subscriptionExists] = await pubsub.subscription(mainSubscription!).exists();
    if (!subscriptionExists) {
      await mainTopicRef.createSubscription(mainSubscription!, {
        deadLetterPolicy: {
          deadLetterTopic: dlqTopicRef.name,
          maxDeliveryAttempts,
        },
        retryPolicy: {
          minimumBackoff: { seconds: 10 },
          maximumBackoff: { seconds: 600 },
        },
        enableMessageOrdering: true,
        filter: 'attributes.type = "gmail.push"',
        pushConfig: {
          pushEndpoint: process.env.GMAIL_WEBHOOK_URL || `${NEXT_PUBLIC_APP_URL}/api/gmail/webhook`,
          attributes: {
            'x-goog-version': 'v1',
            'Authorization': `Bearer ${PUBSUB_SECRET_TOKEN || ''}`
          }
        },
      });
      await logger.info(`Created subscription: ${mainSubscription}`);
    } else {
      // Update existing subscription with new auth token
      const subscription = pubsub.subscription(mainSubscription!);
      const [metadata] = await subscription.getMetadata();
      
      if (!metadata.pushConfig?.attributes?.Authorization ||
          metadata.pushConfig.attributes.Authorization !== `Bearer ${PUBSUB_SECRET_TOKEN}` ||
          metadata.pushConfig.pushEndpoint !== (process.env.GMAIL_WEBHOOK_URL || `${NEXT_PUBLIC_APP_URL}/api/gmail/webhook`)) {
        await subscription.modifyPushConfig({
          pushEndpoint: process.env.GMAIL_WEBHOOK_URL || `${NEXT_PUBLIC_APP_URL}/api/gmail/webhook`,
          attributes: {
            'x-goog-version': 'v1',
            'Authorization': `Bearer ${PUBSUB_SECRET_TOKEN || ''}`
          }
        });
        await logger.info(`Updated subscription auth token and endpoint: ${mainSubscription}`);
      } else {
        await logger.info(`Subscription ${mainSubscription} already exists with correct configuration`);
      }
    }

    await logger.info('PubSub setup completed successfully');
  } catch (error) {
    await logger.error('Error setting up PubSub:', { error });
    process.exit(1);
  }
}

// Run setup if called directly
if (require.main === module) {
  setupPubSub().catch(console.error);
}

export default setupPubSub; 

