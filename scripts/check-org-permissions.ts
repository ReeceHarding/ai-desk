import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Using service role key to bypass RLS
);

async function main() {
  try {
    console.log('Checking organization details...\n');

    // Get all organizations
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('*');

    if (orgsError) {
      console.error('Error fetching organizations:', orgsError);
      return;
    }

    if (!orgs) {
      console.log('No organizations found');
      return;
    }

    console.log('Organizations found:', orgs.length);
    
    orgs.forEach(org => {
      console.log(`\nOrganization: ${org.name} (${org.id})`);
      console.log('Status:', {
        hasGmailToken: !!org.gmail_refresh_token,
        hasAccessToken: !!org.gmail_access_token,
        updatedAt: org.updated_at,
        createdAt: org.created_at,
        config: org.config,
        slaTier: org.sla_tier
      });
    });

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main(); 