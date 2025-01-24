import { Database } from '@/types/supabase';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const supabase = createServerSupabaseClient<Database>({ req, res });

  // Check if user is authenticated
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { token, orgSlug } = req.body;

  if (!token || !orgSlug) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Get organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .single();

    if (orgError || !org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Get and validate invitation
    const { data: invitation, error: inviteError } = await supabase
      .from('invitations')
      .select('*')
      .eq('token', token)
      .eq('organization_id', org.id)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (inviteError || !invitation) {
      return res.status(404).json({ error: 'Invalid or expired invitation' });
    }

    // Verify the invitation is for the current user's email
    if (invitation.email.toLowerCase() !== session.user.email?.toLowerCase()) {
      return res.status(403).json({ error: 'Invitation is for a different email address' });
    }

    // Begin transaction
    const { error: transactionError } = await supabase.rpc('accept_invitation', {
      p_token: token,
      p_user_id: session.user.id,
      p_organization_id: org.id,
      p_role: invitation.role
    });

    if (transactionError) {
      console.error('Transaction error:', transactionError);
      return res.status(500).json({ error: 'Failed to accept invitation' });
    }

    return res.status(200).json({ message: 'Invitation accepted successfully' });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 