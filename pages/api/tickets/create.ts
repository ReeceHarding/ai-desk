import { Database } from '@/types/supabase'
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const supabase = createPagesServerClient<Database>({ req, res })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { organizationId, subject, description } = req.body
    if (!organizationId || !subject || !description) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // get profile to confirm user org role or to place them in the right org
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, org_id, role, email, display_name')
      .eq('id', session.user.id)
      .single()

    if (profileError || !profile) {
      return res.status(500).json({ error: 'User profile not found' })
    }

    // For a "customer" they might pick an org that is different from profile.org_id, that's okay if we allow it
    // We set the ticket org to organizationId.
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .insert({
        subject,
        description,
        customer_id: profile.id,
        org_id: organizationId,
        status: 'open',
        priority: 'medium',
      })
      .select()
      .single()

    if (ticketError || !ticket) {
      return res.status(500).json({ error: ticketError?.message || 'Error creating ticket' })
    }

    return res.status(200).json({ ticket })
  } catch (error: any) {
    console.error('Error creating ticket:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
} 