import { Database } from '@/types/supabase';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { NextApiRequest, NextApiResponse } from 'next';
import { createTransport } from 'nodemailer';

const transporter = createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const supabase = createServerSupabaseClient<Database>({ req, res });

  // Check if user is authenticated and is an admin
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { email, organizationId, role, token } = req.body;

  if (!email || !organizationId || !role || !token) {
    return res.status(400).json({ error: 'Missing required fields' });
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
      return res.status(403).json({ error: 'Not authorized to invite users' });
    }

    // Get organization details
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('name, slug')
      .eq('id', organizationId)
      .single();

    if (orgError || !org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Create invitation
    const { error: inviteError } = await supabase
      .from('invitations')
      .insert({
        organization_id: organizationId,
        email,
        role,
        token
      });

    if (inviteError) {
      console.error('Error creating invitation:', inviteError);
      return res.status(500).json({ error: 'Failed to create invitation' });
    }

    // Send invitation email
    const inviteUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/invite?orgSlug=${org.slug}&role=${role}&token=${token}`;
    
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: `Invitation to join ${org.name} as ${role}`,
      html: `
        <p>You have been invited to join ${org.name} as a ${role}.</p>
        <p>Click the link below to accept the invitation:</p>
        <p><a href="${inviteUrl}">${inviteUrl}</a></p>
        <p>This invitation will expire in 7 days.</p>
      `,
    });

    return res.status(200).json({ message: 'Invitation sent successfully' });
  } catch (error) {
    console.error('Error sending invitation:', error);
    return res.status(500).json({ error: 'Failed to send invitation' });
  }
} 