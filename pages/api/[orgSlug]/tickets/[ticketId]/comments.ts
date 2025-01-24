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
  const { content } = req.body;

  if (!content || typeof content !== 'string') {
    return res.status(400).json({ error: 'Content is required' });
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
      .select('id, created_at, organization_id')
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

    if (membershipError) {
      return res.status(500).json({ error: 'Failed to verify membership' });
    }

    // Create comment
    const { data: comment, error: commentError } = await supabase
      .from('comments')
      .insert({
        ticket_id: ticketId,
        author_id: session.user.id,
        content,
      })
      .select()
      .single();

    if (commentError) {
      console.error('Error creating comment:', commentError);
      return res.status(500).json({ error: 'Failed to create comment' });
    }

    // If the user is an agent, check if this is their first comment on this ticket
    // and update their stats accordingly
    if (membership?.role === 'agent') {
      // Check if this is the first comment by this agent on this ticket
      const { data: previousComments, error: previousError } = await supabase
        .from('comments')
        .select('id')
        .eq('ticket_id', ticketId)
        .eq('author_id', session.user.id)
        .lt('created_at', comment.created_at)
        .limit(1);

      if (!previousError && (!previousComments || previousComments.length === 0)) {
        // This is the first comment by this agent
        const diffMinutes = Math.round(
          (new Date(comment.created_at).getTime() - new Date(ticket.created_at).getTime()) / 
          (1000 * 60)
        );

        // Get current stats
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('extra_json_1')
          .eq('id', session.user.id)
          .single();

        if (!profileError && profile) {
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
                  totalTicketsResponded: currentStats.totalTicketsResponded + 1,
                  totalFirstResponseTime: currentStats.totalFirstResponseTime + diffMinutes
                }
              }
            })
            .eq('id', session.user.id);

          if (updateError) {
            console.error('Error updating agent stats:', updateError);
          }
        }
      }
    }

    return res.status(201).json(comment);
  } catch (error) {
    console.error('Error creating comment:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 