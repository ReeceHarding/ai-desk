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
  
  // Get the authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { orgSlug } = req.query;
  const { description } = req.body;

  if (!orgSlug || typeof orgSlug !== 'string') {
    return res.status(400).json({ error: 'Organization slug is required' });
  }

  if (!description) {
    return res.status(400).json({ error: 'Description is required' });
  }

  try {
    // 1. Get organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, public_mode')
      .eq('slug', orgSlug)
      .single();

    if (orgError || !org) {
      console.error('Error fetching organization:', orgError);
      return res.status(404).json({ error: 'Organization not found' });
    }

    if (!org.public_mode) {
      // TODO: Check for valid token if not public
      return res.status(403).json({ error: 'Organization does not accept public tickets' });
    }

    // 2. Get or create customer profile
    let { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, display_name')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(500).json({ error: 'Profile not found' });
    }

    // 3. Create the ticket with an auto-generated subject
    const subject = `Support Request from ${profile.display_name || 'Customer'}`;
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .insert({
        subject,
        description,
        customer_id: profile.id,
        org_id: org.id,
        status: 'open',
        priority: 'low'
      })
      .select()
      .single();

    if (ticketError || !ticket) {
      console.error('Error creating ticket:', ticketError);
      return res.status(500).json({ error: 'Failed to create ticket' });
    }

    // 4. Add customer to organization members if not already there
    const { error: memberError } = await supabase
      .from('organization_members')
      .upsert({
        organization_id: org.id,
        user_id: profile.id,
        role: 'customer'
      }, {
        onConflict: 'organization_id,user_id'
      });

    if (memberError) {
      console.error('Error adding organization member:', memberError);
      // Non-blocking error, continue
    }

    return res.status(201).json({
      message: 'Ticket created successfully',
      ticketId: ticket.id
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 