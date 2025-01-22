import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';
import { pollAndCreateTickets } from '../utils/gmail';
import dotenv from 'dotenv';
import { resolve } from 'path';

// Mock fetch globally
const originalFetch = global.fetch;
global.fetch = async (url: string | URL | Request, init?: RequestInit) => {
  const urlStr = url.toString();
  if (urlStr.includes('/api/gmail/messages')) {
    return {
      ok: true,
      json: async () => ([
        {
          id: 'msg1',
          threadId: 'thread1',
          labelIds: ['INBOX'],
          subject: 'Test Email 1',
          from: 'sender@example.com',
          to: 'recipient@example.com',
          date: new Date().toISOString(),
          body: {
            text: 'Test email body 1',
            html: '<p>Test email body 1</p>'
          },
          snippet: 'Test snippet 1',
          labels: ['INBOX'],
          attachments: []
        },
        {
          id: 'msg2',
          threadId: 'thread2',
          labelIds: ['INBOX'],
          subject: 'Test Email 2',
          from: 'sender2@example.com',
          to: 'recipient@example.com',
          date: new Date().toISOString(),
          body: {
            text: 'Test email body 2',
            html: '<p>Test email body 2</p>'
          },
          snippet: 'Test snippet 2',
          labels: ['INBOX'],
          attachments: []
        }
      ])
    } as Response;
  }
  if (urlStr.includes('/api/gmail/label')) {
    return {
      ok: true,
      json: async () => ({ success: true })
    } as Response;
  }
  return originalFetch(url, init);
};

// Load environment variables
const envPath = resolve(__dirname, '../.env');
console.log('Loading .env from:', envPath);
dotenv.config({ path: envPath });

// Log environment status
console.log('Environment check:', {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'not set',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'set (hidden)' : 'not set',
  NEXT_PUBLIC_GMAIL_CLIENT_ID: process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID ? 'set (hidden)' : 'not set',
  GMAIL_CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET ? 'set (hidden)' : 'not set'
});

// Initialize Supabase client with service role key for auth operations
console.log('Initializing Supabase client...');
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
);

async function createTestProfile() {
  try {
    // Generate unique names using timestamp
    const timestamp = new Date().getTime();
    const orgName = `Test Organization ${timestamp}`;
    const email = `test.${timestamp}@example.com`;

    console.log('Creating test organization...');
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: orgName,
        sla_tier: 'basic'
      })
      .select()
      .single();

    if (orgError) {
      console.error('Error creating organization:', orgError);
      throw orgError;
    }

    console.log('Created test organization:', org);

    // Create test user in auth.users
    console.log('Creating test user...');
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: 'test-password-123',
      email_confirm: true
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      throw authError;
    }

    console.log('Created auth user:', {
      id: authUser.user.id,
      email: authUser.user.email
    });

    // Wait a moment for the trigger to create the profile
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Update the profile with Gmail tokens
    console.log('Updating test profile with Gmail tokens...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .update({
        role: 'admin',
        display_name: 'Test User',
        org_id: org.id,
        gmail_access_token: process.env.NEXT_PUBLIC_GMAIL_TEST_ACCESS_TOKEN || 'test_access_token',
        gmail_refresh_token: process.env.NEXT_PUBLIC_GMAIL_TEST_REFRESH_TOKEN || 'test_refresh_token',
        gmail_token_expiry: new Date(Date.now() + 3600000).toISOString()
      })
      .eq('id', authUser.user.id)
      .select()
      .single();

    if (profileError) {
      console.error('Error updating profile:', profileError);
      throw profileError;
    }

    console.log('Updated test profile:', {
      id: profile.id,
      email: profile.email,
      org_id: profile.org_id,
      hasAccessToken: !!profile.gmail_access_token,
      hasRefreshToken: !!profile.gmail_refresh_token
    });

    return { profile, org, authUser: authUser.user };
  } catch (error) {
    console.error('Error in createTestProfile:', error);
    throw error;
  }
}

async function cleanupTestData(data: { profile: any, org: any, authUser: any }) {
  try {
    console.log('Cleaning up test data...');
    
    // Delete profile (should be deleted by cascade when user is deleted)
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', data.profile.id);
    
    if (profileError) {
      console.error('Error deleting profile:', profileError);
    }

    // Delete organization
    const { error: orgError } = await supabase
      .from('organizations')
      .delete()
      .eq('id', data.org.id);
    
    if (orgError) {
      console.error('Error deleting organization:', orgError);
    }

    // Delete auth user
    const { error: authError } = await supabase.auth.admin.deleteUser(data.authUser.id);
    
    if (authError) {
      console.error('Error deleting auth user:', authError);
    }

    console.log('Test data cleaned up successfully');
  } catch (error) {
    console.error('Error cleaning up test data:', error);
  }
}

async function testGmailIntegration() {
  let testData;
  try {
    console.log('Starting Gmail integration test...');

    // Create test profile and related data
    testData = await createTestProfile();

    // Test Gmail polling
    console.log(`Testing Gmail polling for profile ${testData.profile.id}...`);
    const tickets = await pollAndCreateTickets(testData.profile.id);

    // Log results
    console.log('Test results:', {
      profileCreated: true,
      ticketsCreated: tickets.length,
      tickets: tickets.map(ticket => ({
        id: ticket.id,
        subject: ticket.subject,
        status: ticket.status,
        created_at: ticket.created_at
      }))
    });

    console.log('Test completed successfully');
  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  } finally {
    if (testData) {
      await cleanupTestData(testData);
    }
    // Restore original fetch
    global.fetch = originalFetch;
  }
}

// Run the test
console.log('Starting Gmail integration test...');
testGmailIntegration()
  .then(() => {
    console.log('Test completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  }); 