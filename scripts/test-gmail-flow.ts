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
  const resolved = value.replace(/\${([^}]+)}/g, (_, varName) => process.env[varName] || '');
  console.log(`Resolving ${value} -> ${resolved}`);
  return resolved;
}

// Get and resolve required environment variables
const SUPABASE_URL = resolveEnvVar(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SERVICE_ROLE_KEY = resolveEnvVar(process.env.SUPABASE_SERVICE_ROLE_KEY) || 
                        resolveEnvVar(process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY);
const GMAIL_CLIENT_ID = resolveEnvVar(process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID);
const GMAIL_CLIENT_SECRET = resolveEnvVar(process.env.GMAIL_CLIENT_SECRET);
const GMAIL_REDIRECT_URI = resolveEnvVar(process.env.NEXT_PUBLIC_GMAIL_REDIRECT_URI);
const GMAIL_PUBSUB_TOPIC = resolveEnvVar(process.env.GMAIL_PUBSUB_TOPIC);
const TEST_EMAIL_RECIPIENT = 'reeceharding@gmail.com'; // Using the connected Gmail account

// Verify all required environment variables
const requiredVars = {
  SUPABASE_URL,
  SERVICE_ROLE_KEY,
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REDIRECT_URI,
  GMAIL_PUBSUB_TOPIC,
  TEST_EMAIL_RECIPIENT
};

const missingVars = Object.entries(requiredVars)
  .filter(([_, value]) => !value)
  .map(([name]) => name);

if (missingVars.length > 0) {
  console.error('Missing required environment variables:');
  missingVars.forEach(name => console.error(`- ${name}`));
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);

async function testGmailFlow() {
  try {
    console.log('=== Starting Gmail Flow Test ===');
    
    // 1. Get organization's Gmail tokens
    console.log('\n1. Fetching organization Gmail tokens...');
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id, gmail_access_token, gmail_refresh_token')
      .order('created_at', { ascending: true });

    if (orgError) {
      throw new Error('Failed to get organizations: ' + orgError.message);
    }

    if (!orgs || orgs.length === 0) {
      throw new Error('No organizations found');
    }

    const org = orgs[0]; // Use the first (oldest) organization

    if (!org.gmail_access_token || !org.gmail_refresh_token) {
      throw new Error('Gmail tokens not found in organization');
    }

    // 2. Set up Gmail client
    console.log('\n2. Setting up Gmail client...');
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

    // Verify Gmail connection
    const profile = await gmail.users.getProfile({ userId: 'me' });
    console.log('Connected to Gmail as:', profile.data.emailAddress);

    // 3. Send test email
    console.log('\n3. Sending test email...');
    const testSubject = `Test Email ${new Date().toISOString()}`;
    const message = [
      'From: me',
      'To: ' + TEST_EMAIL_RECIPIENT,
      'Subject: ' + testSubject,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      '<h2>Gmail Webhook Test</h2>',
      '<p>This is a test email sent at ' + new Date().toISOString() + '</p>',
      '<p>Testing Gmail webhook functionality.</p>',
      '<hr>',
      '<p><i>If you see this email in the tickets list, the webhook is working correctly!</i></p>'
    ].join('\n');

    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    if (!res.data.id) {
      throw new Error('Failed to send test email: No message ID returned');
    }

    console.log('Email sent successfully:', res.data.id);

    // 4. Monitor for webhook activity
    console.log('\n4. Monitoring webhook activity...');
    console.log('Checking for new tickets/email chats every 5 seconds for 2 minutes...');
    console.log('Looking for subject:', testSubject);

    let attempts = 0;
    const maxAttempts = 24; // 2 minutes total (24 * 5 seconds)

    while (attempts < maxAttempts) {
      const { data: emailChats, error: chatError } = await supabase
        .from('ticket_email_chats')
        .select('*')
        .eq('subject', testSubject)
        .order('created_at', { ascending: false })
        .limit(1);

      if (chatError) {
        console.error('Error checking email chats:', chatError);
      } else if (emailChats && emailChats.length > 0) {
        const latestChat = emailChats[0];
        console.log('\n✅ Success! New email chat detected:');
        console.log('- ID:', latestChat.id);
        console.log('- Subject:', latestChat.subject);
        console.log('- Created at:', latestChat.created_at);
        console.log('- Thread ID:', latestChat.thread_id);
        console.log('- Message ID:', latestChat.message_id);
        
        // Also check the ticket
        const { data: ticket } = await supabase
          .from('tickets')
          .select('*')
          .eq('id', latestChat.ticket_id)
          .single();
          
        if (ticket) {
          console.log('\nAssociated Ticket:');
          console.log('- ID:', ticket.id);
          console.log('- Subject:', ticket.subject);
          console.log('- Status:', ticket.status);
          console.log('- Created at:', ticket.created_at);
        }
        
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      attempts++;
      process.stdout.write('.');
    }

    if (attempts >= maxAttempts) {
      console.log('\n❌ No new email chats detected within the timeout period.');
      console.log('Please check:');
      console.log('1. PubSub subscription is properly configured');
      console.log('2. Webhook endpoint is accessible');
      console.log('3. Gmail watch is active');
      console.log('4. Server logs for any errors');
    }

  } catch (error) {
    console.error('Error in test:', error);
    process.exit(1);
  }
}

// Run the test
testGmailFlow(); 
