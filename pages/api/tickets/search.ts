import { Database } from '@/types/supabase';
import { logger } from '@/utils/logger';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createServerSupabaseClient<Database>({ req, res });
    
    // Get user session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get query parameters
    const { 
      q = '', // search query
      status,
      priority,
      page = '1',
      limit = '10',
      org_id
    } = req.query;

    // Get user's profile to check role and org_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, org_id')
      .eq('id', session.user.id)
      .single();

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Build the base query
    let query = supabase
      .from('tickets')
      .select('*, customer:customer_id(display_name), assigned_agent:assigned_agent_id(display_name)', { count: 'exact' });

    // Apply organization filter
    const targetOrgId = org_id || profile.org_id;
    if (targetOrgId) {
      query = query.eq('org_id', targetOrgId);
    }

    // Apply text search if query exists
    if (typeof q === 'string' && q.trim()) {
      const searchTerm = q.trim();
      query = query.or(`subject.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
    }

    // Apply status filter if provided
    if (status && typeof status === 'string' && status !== 'all') {
      query = query.eq('status', status);
    }

    // Apply priority filter if provided
    if (priority && typeof priority === 'string' && priority !== 'all') {
      query = query.eq('priority', priority);
    }

    // Apply pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    // Execute the query
    const { data: tickets, error, count } = await query;

    if (error) {
      logger.error('Error searching tickets:', { error });
      return res.status(500).json({ error: 'Failed to search tickets' });
    }

    return res.status(200).json({
      tickets,
      pagination: {
        total: count || 0,
        page: pageNum,
        limit: limitNum,
        totalPages: count ? Math.ceil(count / limitNum) : 0
      }
    });

  } catch (error) {
    logger.error('Unexpected error in ticket search:', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
} 