import { Database } from '@/types/supabase'
import { logger } from '@/utils/logger'
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    logger.info('[SEARCH_API] Starting organization search')
    
    const supabase = createPagesServerClient<Database>({ req, res })
    const { data: { session } } = await supabase.auth.getSession()
    
    logger.info('[SEARCH_API] Session check:', { 
      hasSession: !!session,
      userId: session?.user?.id
    })
    
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { q } = req.query
    const searchTerm = typeof q === 'string' ? q : ''
    
    logger.info('[SEARCH_API] Searching with term:', { 
      searchTerm,
      query: q
    })

    const { data, error } = await supabase
      .from('organizations')
      .select('id, name')
      .ilike('name', `%${searchTerm}%`)
      .limit(10)

    logger.info('[SEARCH_API] Search results:', {
      success: !error,
      resultCount: data?.length || 0,
      error: error?.message,
      firstResult: data?.[0]
    })

    if (error) {
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json(data || [])
  } catch (error: any) {
    logger.error('[SEARCH_API] Error searching organizations:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
} 