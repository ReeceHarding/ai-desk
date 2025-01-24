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
  const organizationId = req.query.id as string;
  const { publicMode } = req.body;

  if (typeof publicMode !== 'boolean') {
    return res.status(400).json({ error: 'Public mode must be a boolean' });
  }

  // Check if user is authenticated and is an admin
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Verify the user is an admin of the organization
    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', session.user.id)
      .single();

    if (membershipError || !membership || membership.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to update organization settings' });
    }

    // Update public_mode
    const { error: updateError } = await supabase
      .from('organizations')
      .update({ public_mode: publicMode })
      .eq('id', organizationId);

    if (updateError) {
      console.error('Error updating public mode:', updateError);
      return res.status(500).json({ error: 'Failed to update public mode' });
    }

    return res.status(200).json({ message: 'Public mode updated successfully' });
  } catch (error) {
    console.error('Error updating public mode:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 