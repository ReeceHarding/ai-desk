import { createClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Helper function to wait for profile creation
async function waitForProfile(userId: string, maxAttempts = 10): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    console.log(`[TEST] Attempt ${i + 1} of ${maxAttempts} to find profile for user ${userId}`);
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profile) {
      console.log('[TEST] Profile found:', profile);
      return { profile, error: null };
    }

    if (error && error.code !== 'PGRST116') {
      console.error('[TEST] Unexpected error while waiting for profile:', error);
      return { profile: null, error };
    }

    console.log('[TEST] Profile not found yet, waiting 1 second...');
    // Wait 1 second before next attempt
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.error('[TEST] Profile creation timeout after ${maxAttempts} attempts');
  return { profile: null, error: new Error('Profile creation timeout') };
}

describe('Sign-up Flow', () => {
  let testEmail: string;
  let testPassword: string;
  let userId: string;

  beforeEach(() => {
    testEmail = `test${Date.now()}@example.com`;
    testPassword = 'testPassword123!';
  });

  afterEach(async () => {
    if (userId) {
      console.log('[TEST] Cleaning up test data for user:', userId);
      // Clean up test data
      await supabase.from('organization_members').delete().eq('user_id', userId);
      await supabase.from('organizations').delete().eq('created_by', userId);
      await supabase.from('profiles').delete().eq('id', userId);
      await supabase.auth.admin.deleteUser(userId);
    }
  });

  it('should create a new user with profile and organization', async () => {
    // 1. Sign up user
    console.log('[TEST] Starting sign-up with email:', testEmail);
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    expect(signUpError).toBeNull();
    expect(signUpData.user).toBeDefined();
    userId = signUpData.user!.id;
    console.log('[TEST] User created with ID:', userId);

    // 2. Wait for and check profile
    console.log('[TEST] Waiting for profile creation...');
    const { profile, error: profileError } = await waitForProfile(userId);
    expect(profileError).toBeNull();
    expect(profile).toBeDefined();
    expect(profile.email).toBe(testEmail);
    expect(profile.role).toBe('customer'); // Initially created as customer
    console.log('[TEST] Profile verified');

    // 3. Create organization and update profile
    console.log('[TEST] Creating organization...');
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({ 
        name: `${testEmail.split('@')[0]}'s Organization`,
        email: testEmail,
        created_by: userId,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    expect(orgError).toBeNull();
    expect(org).toBeDefined();
    expect(org.email).toBe(testEmail);
    console.log('[TEST] Organization verified:', org.id);

    // 4. Create organization membership
    console.log('[TEST] Creating organization membership...');
    const { error: memberError } = await supabase
      .from('organization_members')
      .insert({ 
        organization_id: org.id,
        user_id: userId,
        role: 'admin',
        created_at: new Date().toISOString()
      });

    expect(memberError).toBeNull();
    console.log('[TEST] Membership created');

    // 5. Update profile with org_id and role
    console.log('[TEST] Updating profile...');
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({ 
        org_id: org.id,
        role: 'admin'
      })
      .eq('id', userId);

    expect(profileUpdateError).toBeNull();
    console.log('[TEST] Profile updated');

    // 6. Verify final state
    const { data: finalProfile, error: finalProfileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    expect(finalProfileError).toBeNull();
    expect(finalProfile.org_id).toBe(org.id);
    expect(finalProfile.role).toBe('admin');
    console.log('[TEST] Final state verified');
  }, 30000);

  it('should handle duplicate email gracefully', async () => {
    // First sign up
    await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    // Try to sign up again with same email
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    expect(data.user).toBeNull();
    expect(error).toBeDefined();
  });

  it('should validate email format', async () => {
    const invalidEmail = 'notanemail';
    const { data, error } = await supabase.auth.signUp({
      email: invalidEmail,
      password: testPassword,
    });

    expect(data.user).toBeNull();
    expect(error).toBeDefined();
  });

  it('should validate password length', async () => {
    const shortPassword = '12345';
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: shortPassword,
    });

    expect(data.user).toBeNull();
    expect(error).toBeDefined();
  });

  it('should handle profile creation failure gracefully', async () => {
    // This test requires mocking the database to force a profile creation failure
    // Implementation depends on your testing setup
  });
}); 