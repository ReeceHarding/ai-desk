import { Database } from '@/types/supabase'
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const supabase = createPagesServerClient<Database>({ req, res })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { ticketId, happiness_score } = req.body
    if (!ticketId || typeof happiness_score !== 'number') {
      return res.status(400).json({ error: 'Missing or invalid fields' })
    }

    // Optional: check if user is the ticket's customer or has permission
    // But for demonstration, just do the update

    const { data, error } = await supabase
      .from('tickets')
      .update({ happiness_score })
      .eq('id', ticketId)
      .select()
      .single()

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ ticket: data })
  } catch (err: any) {
    console.error('Error rating ticket:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
} 