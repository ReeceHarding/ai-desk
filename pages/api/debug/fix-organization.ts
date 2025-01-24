import { createClient } from '@supabase/supabase-js';
import { NextApiRequest, NextApiResponse } from 'next';
import { logger } from '../../../utils/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    logger.warn('Invalid method called on fix-organization endpoint:', { method: req.method });
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Get user ID from query param
    const { userId } = req.query;
    logger.info('Fix organization request received:', { userId });

    if (!userId || typeof userId !== 'string') {
      logger.warn('Invalid or missing user ID:', { userId });
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Check if user exists
    logger.info('Checking if user exists:', { userId });
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError) {
      logger.error('Error fetching user profile:', { userId, error: userError.message, code: userError.code });
      return res.status(404).json({ error: 'User not found', details: userError.message });
    }

    if (!user) {
      logger.error('User profile not found:', { userId });
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info('User profile found:', { 
      userId,
      displayName: user.display_name,
      email: user.email,
      role: user.role,
      currentOrgId: user.org_id 
    });

    // Check if user already has an organization
    logger.info('Checking if user has existing organization membership:', { userId });
    const { data: orgMember, error: orgMemberError } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', userId)
      .single();

    if (orgMemberError && orgMemberError.code !== 'PGRST116') { // PGRST116 is "not found" error
      logger.error('Error checking organization membership:', { 
        userId, 
        error: orgMemberError.message,
        code: orgMemberError.code 
      });
    }

    if (orgMember) {
      logger.info('User already has an organization:', { 
        userId, 
        orgId: orgMember.organization_id,
        role: orgMember.role 
      });
      return res.json({ 
        message: 'User already has an organization', 
        orgId: orgMember.organization_id,
        role: orgMember.role
      });
    }

    // Create new organization
    logger.info('Creating new personal organization for user:', { userId });
    const orgName = user.display_name ? 
      `${user.display_name}'s Organization` : 
      `Personal Organization ${userId.slice(0, 8)}`;

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: orgName,
        created_by: userId,
        email: user.email,
        config: {
          is_personal: true,
          created_at_timestamp: new Date().toISOString(),
        }
      })
      .select()
      .single();

    if (orgError) {
      logger.error('Failed to create organization:', { 
        userId,
        error: orgError.message,
        code: orgError.code,
        details: orgError.details 
      });
      return res.status(500).json({ error: 'Failed to create organization', details: orgError.message });
    }

    if (!org) {
      logger.error('Organization created but no data returned:', { userId });
      return res.status(500).json({ error: 'Failed to create organization - no data returned' });
    }

    logger.info('Organization created successfully:', { 
      userId,
      orgId: org.id,
      orgName: org.name,
      orgEmail: org.email 
    });

    // Add user as admin of organization
    logger.info('Adding user as admin to organization:', { userId, orgId: org.id });
    const { error: memberError } = await supabase
      .from('organization_members')
      .insert({
        organization_id: org.id,
        user_id: userId,
        role: 'admin',
      });

    if (memberError) {
      logger.error('Failed to add user to organization:', { 
        userId,
        orgId: org.id,
        error: memberError.message,
        code: memberError.code 
      });
      return res.status(500).json({ error: 'Failed to add user to organization', details: memberError.message });
    }

    // Update user's org_id in profiles
    logger.info('Updating user profile with organization ID:', { userId, orgId: org.id });
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ org_id: org.id })
      .eq('id', userId);

    if (profileError) {
      logger.error('Failed to update user profile:', { 
        userId,
        orgId: org.id,
        error: profileError.message,
        code: profileError.code 
      });
      return res.status(500).json({ error: 'Failed to update user profile', details: profileError.message });
    }

    logger.info('Organization setup completed successfully:', { 
      userId,
      orgId: org.id,
      orgName: org.name,
      userRole: 'admin'
    });

    return res.json({ 
      message: 'Organization created and user assigned successfully',
      orgId: org.id,
      orgName: org.name,
      userRole: 'admin'
    });

  } catch (error: any) {
    logger.error('Unexpected error in fix-organization:', { 
      error: error.message,
      stack: error.stack,
      userId: req.query.userId 
    });
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
} 