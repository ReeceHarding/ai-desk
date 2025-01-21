import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { pollGmailInbox } from '../utils/gmail';
import { Database } from '../types/supabase';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function main() {
  try {
    console.log('Starting Gmail polling test...');
    
    // First, check all organizations
    const { data: allOrgs, error: allOrgsError } = await supabase
      .from('organizations')
      .select('id, name, gmail_refresh_token');

    if (allOrgsError) {
      console.error('Error fetching organizations:', allOrgsError);
      return;
    }

    console.log(`Found ${allOrgs.length} total organizations`);
    allOrgs.forEach(org => {
      console.log(`- ${org.name} (${org.id}): ${org.gmail_refresh_token ? 'Has Gmail token' : 'No Gmail token'}`);
    });
    
    // Fetch Gmail tokens from the first organization that has them
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, gmail_refresh_token, gmail_access_token')
      .not('gmail_refresh_token', 'is', null)
      .limit(1);

    if (!orgs || orgs.length === 0) {
      console.log('\nNo organizations found with Gmail tokens');
      console.log('Please connect at least one Gmail account first');
      return;
    }

    const org = orgs[0];
    console.log('\nPolling Gmail for organization:', org.id);
    await pollGmailInbox({
      refresh_token: org.gmail_refresh_token!,
      access_token: org.gmail_access_token!,
      token_type: 'Bearer',
      scope: 'https://www.googleapis.com/auth/gmail.modify',
      expiry_date: 0
    });
    
    console.log('Gmail polling test completed successfully');
  } catch (error) {
    console.error('Error during Gmail polling test:', error);
    process.exit(1);
  }
}

main(); 