import { createClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

describe('Signup Flow', () => {
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';
  let userId: string;

  // Cleanup after all tests
  afterAll(async () => {
    if (userId) {
      // Delete the test user and associated data
      await supabase.auth.admin.deleteUser(userId);
    }
  });

  it('should create a new user with email/password', async () => {
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    expect(error).toBeNull();
    expect(data.user).toBeTruthy();
    expect(data.user?.email).toBe(testEmail);
    
    userId = data.user!.id;
  });

  it('should create a profile for the new user', async () => {
    // Wait for trigger to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    expect(error).toBeNull();
    expect(profile).toBeTruthy();
    expect(profile.email).toBe(testEmail);
    expect(profile.role).toBe('customer');
    expect(profile.display_name).toBe(testEmail.split('@')[0]);
  });

  it('should create an organization for the new user', async () => {
    // Wait for trigger to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify organization details
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', userId)
      .single();

    expect(profileError).toBeNull();
    expect(profile?.org_id).toBeTruthy();

    // Get organization details
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', profile!.org_id)
      .single();

    expect(orgError).toBeNull();
    expect(org).toBeTruthy();
    expect(org.created_by).toBe(userId);
    expect(org.email).toBe(testEmail);

    // Verify organization membership
    const { data: member, error: memberCheckError } = await supabase
      .from('organization_members')
      .select('*')
      .eq('user_id', userId)
      .eq('organization_id', org!.id)
      .single();

    expect(memberCheckError).toBeNull();
    expect(member).toBeTruthy();
    expect(member.role).toBe('admin');
  });

  it('should log the signup process', async () => {
    // Wait a bit for logs to be written
    await new Promise(resolve => setTimeout(resolve, 1000));

    // First, try to get all logs to see what's there
    const { data: allLogs, error: allLogsError } = await supabase
      .from('logs')
      .select('*')
      .order('created_at', { ascending: false });

    console.log('All logs:', allLogs);
    console.log('All logs error:', allLogsError);

    // Now try our specific query
    const { data: logs, error } = await supabase
      .from('logs')
      .select('*')
      .eq('level', 'info')
      .contains('metadata', { user_id: userId })
      .order('created_at', { ascending: false });

    console.log('Filtered logs:', logs);
    console.log('Error:', error);
    console.log('User ID being searched:', userId);

    expect(error).toBeNull();
    expect(logs).toBeTruthy();
    
    if (logs?.length === 0) {
      // If no logs found, let's check if we can find any logs with this user ID
      const { data: userLogs } = await supabase
        .from('logs')
        .select('*')
        .contains('metadata', { user_id: userId });
      
      console.log('User logs:', userLogs);
    }

    expect(logs?.length ?? 0).toBeGreaterThan(0);

    // Verify log contents
    const userLog = logs?.find(log => log.metadata?.user_id === userId);
    const triggerLog = logs?.find(log => log.metadata?.trigger === 'handle_new_user');
    
    expect(userLog || triggerLog).toBeTruthy();
  });
}); 