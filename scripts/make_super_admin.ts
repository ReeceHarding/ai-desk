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
    console.log('Setting up super admin account...\n');

    // Your user details
    const userId = '49e6508f-13ec-450b-860d-98e9e813352b';
    const userEmail = 'reeceharding225@gmail.com';
    const orgId = '33b311a0-b110-454e-b7de-3dff655869cb';

    // First create organization if it doesn't exist
    const { data: existingOrg, error: checkOrgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .single();

    if (checkOrgError && checkOrgError.code !== 'PGRST116') {
      console.error('Error checking organization:', checkOrgError);
      return;
    }

    let finalOrgId = orgId;

    if (!existingOrg) {
      console.log('Organization not found, creating new organization...');

      // Create organization
      const { data: newOrg, error: createOrgError } = await supabase
        .from('organizations')
        .insert([
          {
            id: orgId,
            name: 'gmail',  // Domain from email
            sla_tier: 'basic',
            config: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (createOrgError) {
        console.error('Error creating organization:', createOrgError);
        return;
      }

      console.log('Successfully created organization:', newOrg);
      finalOrgId = newOrg.id;
    } else {
      console.log('Organization exists:', existingOrg);
    }

    // Create auth user if doesn't exist
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: userEmail,
      email_confirm: true,
      user_metadata: { name: userEmail.split('@')[0] },
      id: userId
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      return;
    }

    console.log('Auth user created/exists:', authUser);

    // Then check if profile exists
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking profile:', checkError);
      return;
    }

    if (!existingProfile) {
      console.log('Profile not found, creating new profile...');

      // Create profile
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert([
          {
            id: userId,
            email: userEmail,
            display_name: userEmail.split('@')[0],
            role: 'super_admin',
            org_id: finalOrgId,
            metadata: {},
            extra_json_1: {}
          }
        ])
        .select()
        .single();

      if (createError) {
        console.error('Error creating profile:', createError);
        return;
      }

      console.log('Successfully created profile:', newProfile);
    } else {
      console.log('Profile exists, updating role...');

      // Update the profile
      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update({ role: 'super_admin' })
        .eq('id', userId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating role:', updateError);
        return;
      }

      console.log('Successfully updated user role:', updatedProfile);
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main(); 