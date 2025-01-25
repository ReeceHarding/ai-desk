import { logger } from '@/utils/logger';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { startDate, endDate, interval = 'day' } = req.query;

    logger.info('[DASHBOARD_METRICS] Starting metrics fetch', {
      startDate,
      endDate,
      interval
    });

    const supabase = createServerSupabaseClient({ req, res });

    // Get current user and org_id
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      logger.error('[DASHBOARD_METRICS] Auth error:', { 
        error: userError,
        userId: user?.id
      });
      return res.status(401).json({ error: 'Unauthorized' });
    }

    logger.info('[DASHBOARD_METRICS] Got user:', { userId: user.id });

    // Get user's organization ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('org_id, role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      logger.error('[DASHBOARD_METRICS] Profile fetch error:', { 
        error: profileError,
        userId: user.id
      });
      return res.status(404).json({ error: 'Profile not found' });
    }

    if (!profile?.org_id) {
      logger.error('[DASHBOARD_METRICS] No org_id found:', { 
        userId: user.id,
        profile
      });
      return res.status(404).json({ error: 'Organization not found' });
    }

    logger.info('[DASHBOARD_METRICS] Got profile:', { 
      userId: user.id,
      orgId: profile.org_id,
      role: profile.role
    });

    // Check if user is admin or super_admin
    if (!['admin', 'super_admin'].includes(profile.role)) {
      logger.error('[DASHBOARD_METRICS] Unauthorized role:', { 
        userId: user.id,
        role: profile.role
      });
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Fetch all metrics in parallel
    logger.info('[DASHBOARD_METRICS] Fetching metrics...', {
      orgId: profile.org_id,
      startDate,
      endDate
    });

    const [
      avgFirstResponseResult,
      avgResolutionResult,
      statusBreakdownResult,
      agentPerformanceResult,
      ticketVolumeResult
    ] = await Promise.all([
      supabase.rpc('fn_get_avg_first_response_time', {
        p_org_id: profile.org_id,
        p_start_date: startDate as string,
        p_end_date: endDate as string
      }),
      supabase.rpc('fn_get_avg_resolution_time', {
        p_org_id: profile.org_id,
        p_start_date: startDate as string,
        p_end_date: endDate as string
      }),
      supabase.rpc('fn_get_ticket_status_breakdown', {
        p_org_id: profile.org_id
      }),
      supabase.rpc('fn_get_agent_performance', {
        p_org_id: profile.org_id,
        p_start_date: startDate as string,
        p_end_date: endDate as string
      }),
      supabase.rpc('fn_get_ticket_volume', {
        p_org_id: profile.org_id,
        p_interval: interval as string,
        p_start_date: startDate as string,
        p_end_date: endDate as string
      })
    ]);

    // Check for errors in each result
    if (avgFirstResponseResult.error) {
      logger.error('[DASHBOARD_METRICS] Avg first response error:', { 
        error: avgFirstResponseResult.error,
        orgId: profile.org_id
      });
    }
    if (avgResolutionResult.error) {
      logger.error('[DASHBOARD_METRICS] Avg resolution error:', { 
        error: avgResolutionResult.error,
        orgId: profile.org_id
      });
    }
    if (statusBreakdownResult.error) {
      logger.error('[DASHBOARD_METRICS] Status breakdown error:', { 
        error: statusBreakdownResult.error,
        orgId: profile.org_id
      });
    }
    if (agentPerformanceResult.error) {
      logger.error('[DASHBOARD_METRICS] Agent performance error:', { 
        error: agentPerformanceResult.error,
        orgId: profile.org_id
      });
    }
    if (ticketVolumeResult.error) {
      logger.error('[DASHBOARD_METRICS] Ticket volume error:', { 
        error: ticketVolumeResult.error,
        orgId: profile.org_id
      });
    }

    // Format the response
    const metrics = {
      averageFirstResponseTime: avgFirstResponseResult.data || '0m',
      averageResolutionTime: avgResolutionResult.data || '0m',
      ticketStatusBreakdown: statusBreakdownResult.data || [],
      agentPerformance: agentPerformanceResult.data || [],
      ticketVolume: ticketVolumeResult.data || []
    };

    logger.info('[DASHBOARD_METRICS] Metrics fetched successfully:', {
      orgId: profile.org_id,
      hasFirstResponseTime: !!avgFirstResponseResult.data,
      hasResolutionTime: !!avgResolutionResult.data,
      statusBreakdownCount: statusBreakdownResult.data?.length || 0,
      agentCount: agentPerformanceResult.data?.length || 0,
      volumeDataPoints: ticketVolumeResult.data?.length || 0
    });

    return res.status(200).json(metrics);
  } catch (error) {
    logger.error('[DASHBOARD_METRICS] Unexpected error:', { 
      error,
      stack: error instanceof Error ? error.stack : undefined,
      params: {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        interval: req.query.interval
      }
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
} 