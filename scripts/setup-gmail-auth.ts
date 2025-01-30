import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { google } from 'googleapis';
import open from 'open';
import { resolve } from 'path';

// Load environment variables from .env.local if it exists
dotenv.config({ path: resolve(__dirname, '../.env.local') });
// Fallback to .env
dotenv.config({ path: resolve(__dirname, '../.env') });

// Debug: Log environment variables
console.log('Environment variables loaded:', {
  SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  GMAIL_CLIENT_ID: !!process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET: !!process.env.GMAIL_CLIENT_SECRET,
  GMAIL_REDIRECT_URI: !!process.env.NEXT_PUBLIC_GMAIL_REDIRECT_URI
});

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

// Debug: Log resolved variables
console.log('Resolved variables:', {
  SUPABASE_URL: !!SUPABASE_URL,
  SERVICE_ROLE_KEY: !!SERVICE_ROLE_KEY,
  GMAIL_CLIENT_ID: !!GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET: !!GMAIL_CLIENT_SECRET,
  GMAIL_REDIRECT_URI: !!GMAIL_REDIRECT_URI
});

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REDIRECT_URI) {
  console.error('Required environment variables are missing:');
  console.error('- SUPABASE_URL:', !!SUPABASE_URL);
  console.error('- SERVICE_ROLE_KEY:', !!SERVICE_ROLE_KEY);
  console.error('- GMAIL_CLIENT_ID:', !!GMAIL_CLIENT_ID);
  console.error('- GMAIL_CLIENT_SECRET:', !!GMAIL_CLIENT_SECRET);
  console.error('- GMAIL_REDIRECT_URI:', !!GMAIL_REDIRECT_URI);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function setupGmailAuth() {
  try {
    console.log('=== Setting up Gmail Authentication ===\n');

    // 1. Get organization ID
    console.log('1. Getting organization...');
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .order('created_at', { ascending: true });

    if (orgError) {
      throw new Error('Failed to get organizations: ' + orgError.message);
    }

    if (!orgs || orgs.length === 0) {
      throw new Error('No organizations found. Please run npm run setup:org first.');
    }

    const org = orgs[0];
    console.log('Using organization:', {
      id: org.id,
      name: org.name
    });

    // 2. Set up OAuth client
    console.log('\n2. Setting up OAuth client...');
    const oauth2Client = new google.auth.OAuth2(
      GMAIL_CLIENT_ID,
      GMAIL_CLIENT_SECRET,
      GMAIL_REDIRECT_URI
    );

    // Generate auth URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly'
      ],
      state: `organization:${org.id}`,
      prompt: 'consent'
    });

    // 3. Open browser for authentication
    console.log('\n3. Opening browser for Gmail authentication...');
    console.log('Please complete the OAuth flow in your browser.');
    console.log('Auth URL:', authUrl);
    
    await open(authUrl);
    console.log('\nWaiting for authentication to complete...');
    console.log('After authenticating, the tokens will be saved automatically via the callback endpoint.');
    console.log('You can check the status by running: npm run check:gmail-watch');

  } catch (error) {
    console.error('Error in setup:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : '');
    process.exit(1);
  }
}

// Run the setup
setupGmailAuth().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 
