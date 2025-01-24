import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { NextApiRequest, NextApiResponse } from 'next';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServerSupabaseClient({ req, res });
    
    // Get the current user's session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { invitationId } = req.body;

    if (!invitationId) {
      return res.status(400).json({ error: 'Missing invitation ID' });
    }

    // Get the invitation details
    const { data: invitation, error: inviteError } = await supabase
      .from('invitations')
      .select(`
        *,
        organizations!inner (
          name,
          slug
        )
      `)
      .eq('id', invitationId)
      .single();

    if (inviteError || !invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    // Verify the user has permission to send invites for this organization
    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', invitation.organization_id)
      .eq('user_id', session.user.id)
      .single();

    if (membershipError || !membership || membership.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to send invitations' });
    }

    // Send the email
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const inviteUrl = `${baseUrl}/invite?token=${invitation.token}`;

    await resend.emails.send({
      from: 'Zendesk <support@resend.dev>',
      to: invitation.email,
      subject: `You've been invited to join ${invitation.organizations[0].name}`,
      html: `
        <div>
          <h2>You've been invited!</h2>
          <p>You've been invited to join ${invitation.organizations[0].name} as an ${invitation.role}.</p>
          <p>Click the link below to accept your invitation:</p>
          <p><a href="${inviteUrl}">${inviteUrl}</a></p>
          <p>This invitation will expire in 7 days.</p>
        </div>
      `,
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error sending invitation email:', error);
    return res.status(500).json({ error: 'Failed to send invitation email' });
  }
} 