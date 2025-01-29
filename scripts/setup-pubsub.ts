import { PubSub } from '@google-cloud/pubsub';
import dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

// Extract and validate required environment variables
const {
  GOOGLE_CLOUD_PROJECT: projectId,
  GMAIL_PUBSUB_TOPIC,
  GMAIL_PUBSUB_SUBSCRIPTION,
  PUBSUB_DLQ_TOPIC,
  PUBSUB_PRIMARY_REGION = 'europe-north1',
  PUBSUB_MAX_DELIVERY_ATTEMPTS = '5',
  NEXT_PUBLIC_APP_URL
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

    console.log('Setting up PubSub topics and subscriptions...');

    // Create main topic
    const [mainTopicExists] = await pubsub.topic(mainTopic!).exists();
    if (!mainTopicExists) {
      await pubsub.createTopic(mainTopic!);
      console.log(`Created topic: ${mainTopic}`);
    } else {
      console.log(`Topic ${mainTopic} already exists`);
    }

    // Create DLQ topic
    const [dlqTopicExists] = await pubsub.topic(dlqTopic!).exists();
    if (!dlqTopicExists) {
      await pubsub.createTopic(dlqTopic!);
      console.log(`Created DLQ topic: ${dlqTopic}`);
    } else {
      console.log(`DLQ topic ${dlqTopic} already exists`);
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
          pushEndpoint: `${NEXT_PUBLIC_APP_URL}/api/gmail/webhook`,
          attributes: {
            'x-goog-version': 'v1',
          },
        },
      });
      console.log(`Created subscription: ${mainSubscription}`);
    } else {
      console.log(`Subscription ${mainSubscription} already exists`);
    }

    console.log('PubSub setup completed successfully');
  } catch (error) {
    console.error('Error setting up PubSub:', error);
    process.exit(1);
  }
}

// Run setup if called directly
if (require.main === module) {
  setupPubSub().catch(console.error);
}

export default setupPubSub; 

