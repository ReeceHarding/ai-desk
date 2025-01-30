import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
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

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Required environment variables are missing:');
  console.error('- SUPABASE_URL:', !!SUPABASE_URL);
  console.error('- SERVICE_ROLE_KEY:', !!SERVICE_ROLE_KEY);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function setupOrganization() {
  try {
    console.log('=== Setting up Test Organization ===\n');

    // 1. Check if organization exists
    console.log('1. Checking existing organizations...');
    const { data: existingOrgs, error: checkError } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: true });

    if (checkError) {
      throw new Error('Error checking organizations: ' + checkError.message);
    }

    if (existingOrgs && existingOrgs.length > 0) {
      const org = existingOrgs[0]; // Use the first (oldest) organization
      console.log('Using existing organization:', {
        id: org.id,
        name: org.name,
        sla_tier: org.sla_tier,
        gmail_watch_status: org.gmail_watch_status
      });
      return org;
    }

    // 2. Create new organization
    console.log('\n2. Creating new organization...');
    const { data: newOrg, error: createError } = await supabase
      .from('organizations')
      .insert({
        name: 'Test Organization',
        sla_tier: 'basic',
        config: {},
        gmail_watch_status: 'pending'
      })
      .select()
      .single();

    if (createError || !newOrg) {
      throw new Error('Failed to create organization: ' + createError?.message);
    }

    console.log('Organization created successfully:', {
      id: newOrg.id,
      name: newOrg.name,
      sla_tier: newOrg.sla_tier,
      gmail_watch_status: newOrg.gmail_watch_status
    });

    return newOrg;

  } catch (error) {
    console.error('Error in setup:', error);
    process.exit(1);
  }
}

// Run the setup
setupOrganization(); 
