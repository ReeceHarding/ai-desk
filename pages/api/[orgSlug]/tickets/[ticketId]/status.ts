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
  const { orgSlug, ticketId } = req.query;
  const { status } = req.body;

  if (!status || typeof status !== 'string') {
    return res.status(400).json({ error: 'Status is required' });
  }

  // Check if user is authenticated
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
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

    // Get ticket and verify it belongs to the organization
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('id, created_at, organization_id, status')
      .eq('id', ticketId)
      .eq('organization_id', org.id)
      .single();

    if (ticketError || !ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Get user's role in the organization
    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', org.id)
      .eq('user_id', session.user.id)
      .single();

    if (membershipError || !membership || !['admin', 'agent'].includes(membership.role)) {
      return res.status(403).json({ error: 'Not authorized to update ticket status' });
    }

    // Update ticket status
    const { error: updateError } = await supabase
      .from('tickets')
      .update({ status })
      .eq('id', ticketId);

    if (updateError) {
      console.error('Error updating ticket status:', updateError);
      return res.status(500).json({ error: 'Failed to update ticket status' });
    }

    // If the ticket is being marked as solved and the user is an agent,
    // update their resolution time stats
    if (status === 'solved' && membership.role === 'agent' && ticket.status !== 'solved') {
      // Get current stats
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('extra_json_1')
        .eq('id', session.user.id)
        .single();

      if (!profileError && profile) {
        const diffMinutes = Math.round(
          (new Date().getTime() - new Date(ticket.created_at).getTime()) / 
          (1000 * 60)
        );

        const currentStats = profile.extra_json_1?.agentStats || {
          totalTicketsResponded: 0,
          totalFirstResponseTime: 0,
          totalTicketsResolved: 0,
          totalResolutionTime: 0
        };

        // Update stats
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            extra_json_1: {
              ...profile.extra_json_1,
              agentStats: {
                ...currentStats,
                totalTicketsResolved: currentStats.totalTicketsResolved + 1,
                totalResolutionTime: currentStats.totalResolutionTime + diffMinutes
              }
            }
          })
          .eq('id', session.user.id);

        if (updateError) {
          console.error('Error updating agent stats:', updateError);
        }
      }
    }

    return res.status(200).json({ message: 'Ticket status updated successfully' });
  } catch (error) {
    console.error('Error updating ticket status:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 