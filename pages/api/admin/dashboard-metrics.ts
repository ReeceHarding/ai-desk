import { logger } from '@/utils/logger';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const interval = searchParams.get('interval') || 'day';

  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get current user and org_id
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      logger.error('[DASHBOARD_METRICS] Auth error:', { error: userError });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organization ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('org_id, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.org_id) {
      logger.error('[DASHBOARD_METRICS] Profile error:', { error: profileError });
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Check if user is admin or super_admin
    if (!['admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Fetch all metrics in parallel
    const [
      { data: avgFirstResponse },
      { data: avgResolution },
      { data: statusBreakdown },
      { data: agentPerformance },
      { data: ticketVolume }
    ] = await Promise.all([
      supabase.rpc('fn_get_avg_first_response_time', {
        p_org_id: profile.org_id,
        p_start_date: startDate,
        p_end_date: endDate
      }),
      supabase.rpc('fn_get_avg_resolution_time', {
        p_org_id: profile.org_id,
        p_start_date: startDate,
        p_end_date: endDate
      }),
      supabase.rpc('fn_get_ticket_status_breakdown', {
        p_org_id: profile.org_id
      }),
      supabase.rpc('fn_get_agent_performance', {
        p_org_id: profile.org_id,
        p_start_date: startDate,
        p_end_date: endDate
      }),
      supabase.rpc('fn_get_ticket_volume', {
        p_org_id: profile.org_id,
        p_interval: interval,
        p_start_date: startDate,
        p_end_date: endDate
      })
    ]);

    // Format the response
    const metrics = {
      averageFirstResponseTime: avgFirstResponse,
      averageResolutionTime: avgResolution,
      ticketStatusBreakdown: statusBreakdown,
      agentPerformance,
      ticketVolume
    };

    logger.info('[DASHBOARD_METRICS] Metrics fetched successfully');
    return NextResponse.json(metrics);

  } catch (error) {
    logger.error('[DASHBOARD_METRICS] Unexpected error:', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 