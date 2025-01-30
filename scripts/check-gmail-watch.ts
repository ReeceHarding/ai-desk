import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { google } from 'googleapis';
import { resolve } from 'path';

// Load environment variables from .env.local if it exists
dotenv.config({ path: resolve(__dirname, '../.env.local') });
// Fallback to .env
dotenv.config({ path: resolve(__dirname, '../.env') });

// Resolve environment variable substitutions
function resolveEnvVar(value: string | undefined): string | undefined {
  if (!value) return value;
  return value.replace(/\${([^}]+)}/g, (_, varName) => process.env[varName] || '');
}

// Get and resolve required environment variables
const SUPABASE_URL = resolveEnvVar(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SERVICE_ROLE_KEY = resolveEnvVar(process.env.SUPABASE_SERVICE_ROLE_KEY) || 
                        resolveEnvVar(process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY);
const GMAIL_CLIENT_ID = resolveEnvVar(process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID);
const GMAIL_CLIENT_SECRET = resolveEnvVar(process.env.GMAIL_CLIENT_SECRET);
const GMAIL_REDIRECT_URI = resolveEnvVar(process.env.NEXT_PUBLIC_GMAIL_REDIRECT_URI);
const GMAIL_PUBSUB_TOPIC = resolveEnvVar(process.env.GMAIL_PUBSUB_TOPIC);
const GMAIL_WEBHOOK_URL = resolveEnvVar(process.env.GMAIL_WEBHOOK_URL);

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Required environment variables are missing:');
  console.error('- SUPABASE_URL:', !!SUPABASE_URL);
  console.error('- SERVICE_ROLE_KEY:', !!SERVICE_ROLE_KEY);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function checkGmailWatch() {
  try {
    console.log('=== Checking Gmail Watch Status ===\n');

    // 1. Check database status
    console.log('1. Database Status:');
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select(`
        id,
        name,
        gmail_access_token,
        gmail_refresh_token,
        gmail_watch_expiration,
        gmail_watch_resource_id,
        gmail_watch_status
      `)
      .order('created_at', { ascending: true });

    if (orgError) {
      throw new Error('Failed to get organizations: ' + orgError.message);
    }

    if (!orgs || orgs.length === 0) {
      throw new Error('No organizations found in the database');
    }

    // Use the first (oldest) organization
    const org = orgs[0];
    console.log('Using organization:', {
      id: org.id,
      name: org.name,
      watchStatus: org.gmail_watch_status || 'not set',
      watchExpiration: org.gmail_watch_expiration || 'not set',
      hasAccessToken: !!org.gmail_access_token,
      hasRefreshToken: !!org.gmail_refresh_token,
    });

    if (!org.gmail_access_token || !org.gmail_refresh_token) {
      throw new Error('Gmail tokens not found in organization');
    }

    // 2. Check Gmail API status
    console.log('\n2. Gmail API Status:');
    if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REDIRECT_URI) {
      throw new Error('Gmail API credentials not found in environment variables');
    }

    const oauth2Client = new google.auth.OAuth2(
      GMAIL_CLIENT_ID,
      GMAIL_CLIENT_SECRET,
      GMAIL_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: org.gmail_access_token,
      refresh_token: org.gmail_refresh_token,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Get Gmail profile to verify authentication
    const profile = await gmail.users.getProfile({
      userId: 'me'
    });

    console.log('Gmail Connection:', {
      emailAddress: profile.data.emailAddress,
      messagesTotal: profile.data.messagesTotal,
      threadsTotal: profile.data.threadsTotal,
      historyId: profile.data.historyId
    });

    // 3. Check PubSub topic subscription
    console.log('\n3. PubSub Topic Status:');
    if (!GMAIL_PUBSUB_TOPIC) {
      throw new Error('GMAIL_PUBSUB_TOPIC not found in environment variables');
    }
    console.log('Topic Name:', GMAIL_PUBSUB_TOPIC);

    if (!GMAIL_WEBHOOK_URL) {
      throw new Error('GMAIL_WEBHOOK_URL not found in environment variables');
    }
    console.log('Webhook URL:', GMAIL_WEBHOOK_URL);

    // 4. Test watch setup
    console.log('\n4. Testing Watch Setup:');
    const watchResponse = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        labelIds: ['INBOX'],
        topicName: GMAIL_PUBSUB_TOPIC,
      },
    });

    if (!watchResponse.data.historyId || !watchResponse.data.expiration) {
      throw new Error('Invalid watch response from Gmail API');
    }

    console.log('Watch Response:', {
      historyId: watchResponse.data.historyId,
      expiration: new Date(Number(watchResponse.data.expiration)).toISOString(),
    });

    // 5. Update database with new watch info
    const { error: updateError } = await supabase
      .from('organizations')
      .update({
        gmail_watch_expiration: new Date(Number(watchResponse.data.expiration)).toISOString(),
        gmail_watch_status: 'active',
      })
      .eq('id', org.id);

    if (updateError) {
      throw new Error('Failed to update watch status in database: ' + updateError.message);
    }

    console.log('\nDatabase updated with new watch information');
    console.log('\n✅ Gmail watch check complete');

  } catch (error) {
    console.error('Error checking Gmail watch:', error);
    process.exit(1);
  }
}

// Run the check
checkGmailWatch(); 
