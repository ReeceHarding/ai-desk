import { Database } from '@/types/supabase';
import { createClient } from '@supabase/supabase-js';
import { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { orgSlug, ticketId } = req.query;
  const { solved } = req.body;

  if (!orgSlug || !ticketId || typeof orgSlug !== 'string' || typeof ticketId !== 'string') {
    return res.status(400).json({ error: 'Organization slug and ticket ID are required' });
  }

  if (typeof solved !== 'boolean') {
    return res.status(400).json({ error: 'Solved status must be a boolean' });
  }

  try {
    // 1. Get organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .single();

    if (orgError || !org) {
      console.error('Error fetching organization:', orgError);
      return res.status(404).json({ error: 'Organization not found' });
    }

    // 2. Get ticket and verify it belongs to the organization
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('id, org_id, metadata')
      .eq('id', ticketId)
      .eq('org_id', org.id)
      .single();

    if (ticketError || !ticket) {
      console.error('Error fetching ticket:', ticketError);
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // 3. Update the ticket's metadata with customer_side_solved status
    const updatedMetadata = {
      ...ticket.metadata,
      customer_side_solved: solved
    };

    const { data: updatedTicket, error: updateError } = await supabase
      .from('tickets')
      .update({
        metadata: updatedMetadata
      })
      .eq('id', ticket.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating ticket:', updateError);
      return res.status(500).json({ error: 'Failed to update ticket' });
    }

    return res.status(200).json(updatedTicket);
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 