import { Database } from '@/types/supabase';
import { logger } from '@/utils/logger';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import crypto from 'crypto';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const requestId = crypto.randomUUID();

  logger.info('Received invitation request', {
    requestId,
    method: req.method,
    path: req.url
  });

  if (req.method !== 'POST') {
    logger.warn('Invalid method', { 
      requestId,
      method: req.method,
      path: req.url 
    });
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const supabase = createServerSupabaseClient<Database>({ req, res });

  // Check if user is authenticated and is an admin
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError) {
    logger.error('Error getting session:', {
      requestId,
      error: sessionError.message
    });
    return res.status(500).json({ error: 'Internal server error' });
  }

  if (!session?.user) {
    logger.warn('Unauthorized attempt to invite user', { 
      requestId,
      path: req.url 
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { email, organizationId, role } = req.body;

  logger.info('Processing invitation request', {
    requestId,
    email,
    organizationId,
    role,
    userId: session.user.id
  });

  if (!email || !organizationId || !role || !['agent', 'admin'].includes(role)) {
    logger.warn('Invalid invitation request', {
      requestId,
      email: !!email,
      organizationId: !!organizationId,
      role,
      userId: session.user.id
    });
    return res.status(400).json({ error: 'Missing or invalid required fields' });
  }

  try {
    // Verify the user is an admin of the organization
    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', session.user.id)
      .single();

    if (membershipError) {
      logger.error('Error checking user membership:', {
        requestId,
        error: membershipError.message,
        userId: session.user.id,
        organizationId
      });
      return res.status(500).json({ error: 'Failed to verify organization membership' });
    }

    if (!membership || membership.role !== 'admin') {
      logger.warn('User not authorized to invite for organization', {
        requestId,
        userId: session.user.id,
        organizationId,
        userRole: membership?.role
      });
      return res.status(403).json({ error: 'Not authorized to invite users' });
    }

    // Generate a secure random token
    const token = crypto.randomBytes(32).toString('hex');

    // Create invitation
    const { data: invitation, error: inviteError } = await supabase
      .from('invitations')
      .insert({
        organization_id: organizationId,
        email,
        role,
        token
      })
      .select()
      .single();

    if (inviteError) {
      logger.error('Failed to create invitation:', {
        requestId,
        error: inviteError.message,
        details: inviteError.details
      });
      return res.status(500).json({ error: 'Failed to create invitation' });
    }

    if (!invitation) {
      logger.error('No invitation data returned:', {
        requestId
      });
      return res.status(500).json({ error: 'Invitation creation returned no data' });
    }

    // Generate invitation link
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const inviteUrl = `${baseUrl}/invite?token=${token}`;

    logger.info('Invitation created successfully', {
      requestId,
      invitationId: invitation.id,
      email,
      organizationId,
      role
    });

    return res.status(200).json({ 
      message: 'Invitation created successfully',
      invitationId: invitation.id,
      invitationLink: inviteUrl
    });
  } catch (error: any) {
    logger.error('Error processing invitation:', {
      requestId,
      error: error.message,
      stack: error.stack
    });
    return res.status(500).json({ error: 'Failed to process invitation' });
  }
} 