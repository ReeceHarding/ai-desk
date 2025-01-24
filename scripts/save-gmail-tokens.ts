import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

interface PostgrestError {
  code: string;
  message: string;
  details?: string;
  hint?: string;
}

async function saveGmailTokens() {
  // Load environment variables
  dotenv.config();

  // Initialize Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Get organization with Gmail tokens
    const { data: org, error } = await supabase
      .from('organizations')
      .select('gmail_access_token, gmail_refresh_token, gmail_history_id')
      .eq('id', 'ee0f56a0-4130-4398-bc2d-27529f82efb1')
      .single();

    // If no organization exists yet, use environment variables
    const tokens = {
      gmail_access_token: org?.gmail_access_token || process.env.SEED_GMAIL_ACCESS_TOKEN,
      gmail_refresh_token: org?.gmail_refresh_token || process.env.SEED_GMAIL_REFRESH_TOKEN,
      gmail_history_id: org?.gmail_history_id || process.env.SEED_GMAIL_HISTORY_ID
    };

    if (!tokens.gmail_access_token || !tokens.gmail_refresh_token) {
      console.error('No Gmail tokens found in organization or environment');
      process.exit(1);
    }

    // Read existing .env file
    const envPath = path.join(process.cwd(), '.env');
    const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

    // Parse existing env vars
    const envVars = dotenv.parse(envContent);

    // Update Gmail tokens
    envVars.SEED_GMAIL_ACCESS_TOKEN = tokens.gmail_access_token;
    envVars.SEED_GMAIL_REFRESH_TOKEN = tokens.gmail_refresh_token;
    envVars.SEED_GMAIL_HISTORY_ID = tokens.gmail_history_id || '';

    // Convert env vars back to string
    const newEnvContent = Object.entries(envVars)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Write back to .env file
    fs.writeFileSync(envPath, newEnvContent);

    console.log('Gmail tokens saved to .env file');
  } catch (error) {
    const pgError = error as PostgrestError;
    if (pgError.code === 'PGRST116') {
      // Organization doesn't exist yet, but we have tokens in environment
      if (!process.env.SEED_GMAIL_ACCESS_TOKEN || !process.env.SEED_GMAIL_REFRESH_TOKEN) {
        console.error('No Gmail tokens found in environment');
        process.exit(1);
      }
      console.log('Using existing environment tokens');
    } else {
      console.error('Failed to save Gmail tokens:', error);
      process.exit(1);
    }
  }
}

saveGmailTokens(); 