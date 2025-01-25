import { Database } from '@/types/supabase';
import { logger } from '@/utils/logger';
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import { format } from 'date-fns';
import { NextApiRequest, NextApiResponse } from 'next';

interface Ticket {
  created_at: string;
  status: string;
  first_response_time?: number;
  resolution_time?: number;
}

interface TicketWithResponseTimes {
  first_response_time: number | null;
  resolution_time: number | null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    await logger.warn('Invalid method', { method: req.method });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createPagesServerClient<Database>({ req, res });
    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession();

    if (sessionError) {
      await logger.error('Session error', { error: sessionError });
      return res.status(401).json({ error: 'Session error' });
    }

    if (!session) {
      await logger.warn('No session found');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user's organization and role
    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', session.user.id)
      .single();

    if (!profile?.org_id) {
      await logger.error('No organization found for user');
      return res.status(400).json({ error: 'No organization found' });
    }

    // Check if user is admin
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', profile.org_id)
      .eq('user_id', session.user.id)
      .single();

    if (!membership || membership.role !== 'admin') {
      await logger.warn('User is not an admin');
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { startDate, endDate, interval } = req.query;

    // Get ticket status breakdown
    const { data: tickets } = await supabase
      .from('tickets')
      .select('status')
      .eq('org_id', profile.org_id);

    const ticketStatusBreakdown = tickets?.reduce((acc: Record<string, number>, ticket) => {
      acc[ticket.status] = (acc[ticket.status] || 0) + 1;
      return acc;
    }, {});

    const ticketStatusData = Object.entries(ticketStatusBreakdown || {}).map(([status, count]) => ({
      status,
      count
    }));

    // Get agent performance
    const { data: agents } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', profile.org_id)
      .eq('role', 'agent');

    const agentPerformance = await Promise.all(
      (agents || []).map(async (agent) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', agent.user_id)
          .single();

        const { data: stats } = await supabase
          .from('tickets')
          .select('*')
          .eq('org_id', profile.org_id)
          .eq('assigned_to', agent.user_id);

        const totalTicketsAssigned = stats?.length || 0;
        const totalTicketsResolved = stats?.filter(t => t.status === 'solved').length || 0;
        const totalFirstResponseTime = stats?.reduce((acc, t) => acc + (t.first_response_time || 0), 0) || 0;
        const totalResolutionTime = stats?.reduce((acc, t) => acc + (t.resolution_time || 0), 0) || 0;

        return {
          agent_id: agent.user_id,
          agent_name: profile?.display_name || profile?.email || 'Unknown',
          tickets_assigned: totalTicketsAssigned,
          tickets_resolved: totalTicketsResolved,
          avg_response_time: totalTicketsAssigned > 0 ? 
            Math.round(totalFirstResponseTime / totalTicketsAssigned) + 'm' : '0m',
          avg_resolution_time: totalTicketsResolved > 0 ? 
            Math.round(totalResolutionTime / totalTicketsResolved) + 'm' : '0m'
        };
      })
    );

    // Get ticket volume over time
    const { data: ticketVolume } = await supabase
      .from('tickets')
      .select('created_at, status')
      .eq('org_id', profile.org_id)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at');

    // Group tickets by day/week/month
    const volumeByPeriod = (ticketVolume || []).reduce((acc: any, ticket) => {
      const date = new Date(ticket.created_at);
      let period;
      
      switch (interval) {
        case 'week':
          period = format(date, 'yyyy-ww');
          break;
        case 'month':
          period = format(date, 'yyyy-MM');
          break;
        default:
          period = format(date, 'yyyy-MM-dd');
      }

      if (!acc[period]) {
        acc[period] = { new_tickets: 0, resolved_tickets: 0 };
      }

      acc[period].new_tickets++;
      if (ticket.status === 'solved') {
        acc[period].resolved_tickets++;
      }

      return acc;
    }, {});

    const ticketVolumeData = Object.entries(volumeByPeriod).map(([time_bucket, data]: [string, any]) => ({
      time_bucket,
      ...data
    }));

    // Calculate average response and resolution times
    const { data: allTickets } = await supabase
      .from('tickets')
      .select('first_response_time, resolution_time')
      .eq('org_id', profile.org_id)
      .not('first_response_time', 'is', null);

    const totalFirstResponseTime = (allTickets || []).reduce((acc: number, t: TicketWithResponseTimes) => 
      acc + (t.first_response_time || 0), 0);
    const totalResolutionTime = (allTickets || []).reduce((acc: number, t: TicketWithResponseTimes) => 
      acc + (t.resolution_time || 0), 0);
    const averageFirstResponseTime = allTickets?.length ? 
      Math.round(totalFirstResponseTime / allTickets.length) + 'm' : '0m';
    const averageResolutionTime = allTickets?.length ? 
      Math.round(totalResolutionTime / allTickets.length) + 'm' : '0m';

    await logger.info('Successfully fetched dashboard metrics');

    return res.status(200).json({
      averageFirstResponseTime,
      averageResolutionTime,
      ticketStatusBreakdown: ticketStatusData,
      agentPerformance,
      ticketVolume: ticketVolumeData
    });
  } catch (error: any) {
    await logger.error('Failed to fetch dashboard metrics', { error });
    return res.status(500).json({ 
      error: 'Failed to fetch metrics',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
} 