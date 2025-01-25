import { SupabaseClient } from '@supabase/supabase-js';

export async function createUserOrganization(supabase: SupabaseClient, userId: string, email: string) {
  try {
    if (!userId || !email) {
      throw new Error('User ID and email are required');
    }

    console.log('[SIGNUP] Creating profile and organization for user:', { userId, email });
    
    // Wait a bit for the trigger to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // First, check if user already has an organization through profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, org_id')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('[SIGNUP] Error checking profile:', profileError);
      throw profileError;
    }

    if (profile?.org_id) {
      console.log('[SIGNUP] Profile already has an organization:', profile.org_id);
      return;
    }

    // Double check organization_members as well
    const { data: existingMember } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .single();

    if (existingMember?.organization_id) {
      console.log('[SIGNUP] User already has an organization:', existingMember.organization_id);
      
      // Update profile with org_id if needed
      if (!profile?.org_id) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ org_id: existingMember.organization_id })
          .eq('id', userId);
          
        if (updateError) {
          console.error('[SIGNUP] Error updating profile with org_id:', updateError);
        }
      }
      return;
    }
    
    // Create organization with user's email domain as name
    const emailPrefix = email.split('@')[0];
    const orgName = `${emailPrefix}'s Organization`;
    
    // Create the organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({ 
        name: orgName.slice(0, 100), // Ensure name isn't too long
        email: email,
        created_by: userId,
        created_at: new Date().toISOString(),
        owner_id: userId, // Add owner_id as it's required
        config: {
          is_personal: true,
          is_current: true,
          created_at_timestamp: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (orgError) {
      console.error('[SIGNUP] Error creating organization:', orgError);
      throw orgError;
    }

    console.log('[SIGNUP] Organization created:', org);

    // Associate user with organization
    const { error: memberError } = await supabase
      .from('organization_members')
      .insert({ 
        organization_id: org.id,
        user_id: userId,
        role: 'admin', // Make the creator an admin
        created_at: new Date().toISOString()
      });

    if (memberError) {
      console.error('[SIGNUP] Error creating organization member:', memberError);
      // Clean up the organization if member association fails
      await supabase.from('organizations').delete().eq('id', org.id);
      throw memberError;
    }

    // Update profile with org_id
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({ org_id: org.id })
      .eq('id', userId);

    if (profileUpdateError) {
      console.error('[SIGNUP] Error updating profile with org_id:', profileUpdateError);
      // Clean up the organization and member if profile update fails
      await supabase.from('organization_members').delete().eq('organization_id', org.id);
      await supabase.from('organizations').delete().eq('id', org.id);
      throw profileUpdateError;
    }

    console.log('[SIGNUP] User associated with organization:', { userId, orgId: org.id });

    return org;
  } catch (error) {
    console.error('[SIGNUP] Error in createUserOrganization:', error);
    throw error;
  }
} 