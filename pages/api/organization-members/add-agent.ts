import { Database } from '@/types/supabase'
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const supabase = createPagesServerClient<Database>({ req, res })
    const { data: { session }} = await supabase.auth.getSession()
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { orgId } = req.body
    if (!orgId) {
      return res.status(400).json({ error: 'orgId is required' })
    }

    // fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, org_id')
      .eq('id', session.user.id)
      .single()
    if (profileError || !profile) {
      return res.status(500).json({ error: 'Profile not found' })
    }

    // Insert or update membership
    await supabase
      .from('organization_members')
      .upsert({
        organization_id: orgId,
        user_id: profile.id,
        role: 'agent'
      })

    // Optionally set user's org_id if we want
    await supabase
      .from('profiles')
      .update({ org_id: orgId })
      .eq('id', profile.id)

    return res.status(200).json({ success: true })
  } catch (error:any) {
    console.error('Error adding agent membership:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
} 