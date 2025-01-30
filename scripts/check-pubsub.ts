import { PubSub } from '@google-cloud/pubsub';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { logger } from '../utils/logger';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Extract and validate required environment variables
const {
  GOOGLE_CLOUD_PROJECT: projectId,
  GMAIL_PUBSUB_TOPIC,
  GMAIL_PUBSUB_SUBSCRIPTION,
  PUBSUB_DLQ_TOPIC,
} = process.env;

// Extract topic and subscription names from full paths
const mainTopic = GMAIL_PUBSUB_TOPIC?.split('/').pop();
const mainSubscription = GMAIL_PUBSUB_SUBSCRIPTION?.split('/').pop();
const dlqTopic = PUBSUB_DLQ_TOPIC?.split('/').pop();

if (!projectId || !mainTopic || !mainSubscription || !dlqTopic) {
  console.error('Missing required environment variables');
  process.exit(1);
}

interface SubscriptionMetadata {
  pushConfig?: {
    pushEndpoint?: string;
  };
  messageRetentionDuration?: string;
  enableMessageOrdering?: boolean;
  deadLetterPolicy?: any;
  retryPolicy?: any;
}

interface TopicMetadata {
  messageStats?: {
    count?: string;
  };
}

interface PubSubStats {
  mainTopicExists: boolean;
  dlqTopicExists: boolean;
  subscriptionExists: boolean;
  subscriptionDetails?: {
    pushEndpoint?: string;
    messageRetentionDuration?: string;
    messageOrderingEnabled?: boolean;
    deadLetterPolicy?: any;
    retryPolicy?: any;
  };
  dlqMessageCount: number;
  activeWatchCount: number;
  expiringWatchCount: number;
  failedWatchCount: number;
}

async function checkPubSubSetup(): Promise<PubSubStats> {
  const pubsub = new PubSub({ projectId });
  const stats: PubSubStats = {
    mainTopicExists: false,
    dlqTopicExists: false,
    subscriptionExists: false,
    dlqMessageCount: 0,
    activeWatchCount: 0,
    expiringWatchCount: 0,
    failedWatchCount: 0
  };

  try {
    // Check main topic
    const [mainTopicExists] = await pubsub.topic(mainTopic!).exists();
    stats.mainTopicExists = mainTopicExists;

    // Check DLQ topic
    const [dlqTopicExists] = await pubsub.topic(dlqTopic!).exists();
    stats.dlqTopicExists = dlqTopicExists;

    // Check subscription
    const [subscriptionExists] = await pubsub.subscription(mainSubscription!).exists();
    stats.subscriptionExists = subscriptionExists;

    if (subscriptionExists) {
      const [subscription] = await pubsub.subscription(mainSubscription!).get();
      const metadata = subscription.metadata as SubscriptionMetadata;
      
      stats.subscriptionDetails = {
        pushEndpoint: metadata.pushConfig?.pushEndpoint || undefined,
        messageRetentionDuration: metadata.messageRetentionDuration || undefined,
        messageOrderingEnabled: metadata.enableMessageOrdering || false,
        deadLetterPolicy: metadata.deadLetterPolicy,
        retryPolicy: metadata.retryPolicy
      };
    }

    // Get DLQ message count
    if (dlqTopicExists) {
      const [dlqMetadata] = await pubsub.topic(dlqTopic!).getMetadata();
      const metadata = dlqMetadata as unknown as TopicMetadata;
      stats.dlqMessageCount = Number(metadata.messageStats?.count || '0');
    }

    // Check Gmail watch status
    const { data: watchStats } = await supabase.rpc('get_gmail_watch_stats');
    if (watchStats) {
      stats.activeWatchCount = watchStats.active_count || 0;
      stats.expiringWatchCount = watchStats.expiring_count || 0;
      stats.failedWatchCount = watchStats.failed_count || 0;
    }

    return stats;
  } catch (error) {
    console.error('Error checking PubSub setup:', error);
    throw error;
  }
}

async function logPubSubStats(stats: PubSubStats) {
  const timestamp = new Date().toISOString();
  
  // Log to console
  console.log('=== PubSub Status Check ===');
  console.log(`Timestamp: ${timestamp}`);
  console.log('Topics:');
  console.log(`  - Main Topic (${mainTopic}): ${stats.mainTopicExists ? '✅' : '❌'}`);
  console.log(`  - DLQ Topic (${dlqTopic}): ${stats.dlqTopicExists ? '✅' : '❌'}`);
  console.log(`Subscription (${mainSubscription}): ${stats.subscriptionExists ? '✅' : '❌'}`);
  
  if (stats.subscriptionDetails) {
    console.log('Subscription Details:');
    console.log(`  - Push Endpoint: ${stats.subscriptionDetails.pushEndpoint}`);
    console.log(`  - Message Ordering: ${stats.subscriptionDetails.messageOrderingEnabled ? 'Enabled' : 'Disabled'}`);
    console.log(`  - Dead Letter Policy: ${JSON.stringify(stats.subscriptionDetails.deadLetterPolicy, null, 2)}`);
  }
  
  console.log('\nWatch Status:');
  console.log(`  - Active: ${stats.activeWatchCount}`);
  console.log(`  - Expiring Soon: ${stats.expiringWatchCount}`);
  console.log(`  - Failed: ${stats.failedWatchCount}`);
  console.log(`\nDLQ Messages: ${stats.dlqMessageCount}`);

  // Log to database
  await supabase.from('audit_logs').insert({
    action: 'pubsub_status_check',
    status: stats.mainTopicExists && stats.dlqTopicExists && stats.subscriptionExists ? 'success' : 'warning',
    metadata: {
      stats,
      timestamp
    }
  });

  // Log warnings if needed
  if (stats.dlqMessageCount > 0) {
    await logger.warn('Messages found in DLQ', {
      count: stats.dlqMessageCount,
      topic: dlqTopic
    });
  }

  if (stats.expiringWatchCount > 0) {
    await logger.warn('Gmail watches expiring soon', {
      count: stats.expiringWatchCount
    });
  }

  if (stats.failedWatchCount > 0) {
    await logger.error('Failed Gmail watches detected', {
      count: stats.failedWatchCount
    });
  }
}

// Run check if called directly
if (require.main === module) {
  checkPubSubSetup()
    .then(logPubSubStats)
    .catch(error => {
      console.error('Error running PubSub check:', error);
      process.exit(1);
    });
}

export { checkPubSubSetup, logPubSubStats };


