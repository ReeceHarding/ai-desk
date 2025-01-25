import { Database } from '@/types/supabase'
import { logger } from '@/utils/logger'
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    logger.info('[UPDATE_ORG] Starting organization update')
    
    const supabase = createPagesServerClient<Database>({ req, res })
    const { data: { session } } = await supabase.auth.getSession()
    
    logger.info('[UPDATE_ORG] Session check:', { 
      hasSession: !!session,
      userId: session?.user?.id
    })
    
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { organizationId } = req.body
    logger.info('[UPDATE_ORG] Request body:', { organizationId })
    
    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID is required' })
    }

    // First verify the organization exists
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', organizationId)
      .single()

    logger.info('[UPDATE_ORG] Organization check:', {
      found: !!org,
      error: orgError?.message
    })

    if (orgError || !org) {
      return res.status(404).json({ error: 'Organization not found' })
    }

    // Update the user's profile with the selected organization
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ org_id: organizationId })
      .eq('id', session.user.id)

    logger.info('[UPDATE_ORG] Profile update:', {
      success: !updateError,
      error: updateError?.message
    })

    if (updateError) {
      return res.status(500).json({ error: updateError.message })
    }

    return res.status(200).json({ success: true })
  } catch (error: any) {
    logger.error('[UPDATE_ORG] Error updating organization:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
} 