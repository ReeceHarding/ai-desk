import { Database } from '@/types/supabase'
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const supabase = createPagesServerClient<Database>({ req, res })
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { display_name, role } = req.body
    if (!display_name || !role) {
      return res.status(400).json({ error: 'Missing fields' })
    }

    // update the profile
    const { error } = await supabase
      .from('profiles')
      .update({ display_name, role })
      .eq('id', session.user.id)

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ success: true })
  } catch (error: any) {
    console.error('Error in onboarding update:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
} 