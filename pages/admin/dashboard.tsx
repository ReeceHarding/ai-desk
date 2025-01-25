import { logger } from '@/utils/logger';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Card, Text, Title } from '@tremor/react';
import { format, subDays } from 'date-fns';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';

interface DashboardMetrics {
  averageFirstResponseTime: string;
  averageResolutionTime: string;
  ticketStatusBreakdown: Array<{
    status: string;
    count: number;
  }>;
  agentPerformance: Array<{
    agent_id: string;
    agent_name: string;
    tickets_assigned: number;
    tickets_resolved: number;
    avg_response_time: string;
    avg_resolution_time: string;
  }>;
  ticketVolume: Array<{
    time_bucket: string;
    new_tickets: number;
    resolved_tickets: number;
  }>;
}

const COLORS = {
  open: '#3498db',
  pending: '#f1c40f',
  on_hold: '#e67e22',
  solved: '#27ae60',
  closed: '#95a5a6',
  overdue: '#e74c3c'
};

const CHART_HEIGHT = 300;

export default function AdminDashboard() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [interval, setInterval] = useState('day');
  const supabase = createClientComponentClient();

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/admin/dashboard-metrics?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&interval=${interval}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }

      const data = await response.json();
      setMetrics(data);
      setError(null);
    } catch (err) {
      logger.error('[ADMIN_DASHBOARD] Failed to fetch metrics:', { error: err });
      setError('Failed to load dashboard metrics');
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, interval]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Set up real-time subscription for ticket updates
  useEffect(() => {
    const channel = supabase
      .channel('ticket_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets'
        },
        () => {
          fetchMetrics();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchMetrics]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="text-center">
          Loading dashboard...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="text-center text-red-600">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="py-10">
        <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="md:flex md:items-center md:justify-between">
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold leading-tight text-gray-900">
                Admin Dashboard
              </h1>
            </div>
            <div className="mt-4 flex md:mt-0 md:ml-4">
              <select
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <option value="hour">Hourly</option>
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
              </select>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto sm:px-6 lg:px-8">
          {/* KPI Cards */}
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <Title>Average First Response</Title>
              <Text className="mt-4 text-2xl font-semibold">
                {metrics?.averageFirstResponseTime || '0m'}
              </Text>
            </Card>
            <Card>
              <Title>Average Resolution Time</Title>
              <Text className="mt-4 text-2xl font-semibold">
                {metrics?.averageResolutionTime || '0m'}
              </Text>
            </Card>
            <Card>
              <Title>Total Tickets</Title>
              <Text className="mt-4 text-2xl font-semibold">
                {metrics?.ticketStatusBreakdown?.reduce((acc, curr) => acc + curr.count, 0) || 0}
              </Text>
            </Card>
          </div>

          {/* Charts Section */}
          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* Ticket Volume Over Time */}
            <Card>
              <Title>Ticket Volume Over Time</Title>
              <div className="h-[400px] mt-4">
                <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                  <AreaChart data={metrics?.ticketVolume || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="time_bucket"
                      tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                    />
                    <YAxis />
                    <Tooltip
                      labelFormatter={(value) => format(new Date(value), 'MMM dd, yyyy')}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="new_tickets"
                      name="New Tickets"
                      stroke="#3498db"
                      fill="#3498db"
                      fillOpacity={0.1}
                    />
                    <Area
                      type="monotone"
                      dataKey="resolved_tickets"
                      name="Resolved Tickets"
                      stroke="#27ae60"
                      fill="#27ae60"
                      fillOpacity={0.1}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Ticket Status Distribution */}
            <Card>
              <Title>Ticket Status Distribution</Title>
              <div className="h-[400px] mt-4">
                <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                  <PieChart>
                    <Pie
                      data={metrics?.ticketStatusBreakdown || []}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {metrics?.ticketStatusBreakdown?.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[entry.status as keyof typeof COLORS]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Agent Performance */}
          <Card className="mt-8">
            <Title>Agent Performance</Title>
            <div className="h-[400px] mt-4">
              <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
                <BarChart data={metrics?.agentPerformance || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="agent_name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="tickets_assigned"
                    name="Tickets Assigned"
                    fill="#3498db"
                  />
                  <Bar
                    dataKey="tickets_resolved"
                    name="Tickets Resolved"
                    fill="#27ae60"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Action Buttons */}
          <div className="mt-8 flex space-x-4">
            <button
              onClick={() => router.push('/admin/invite-agent')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Invite Agent
            </button>
            <button
              onClick={() => router.push('/admin/workflows')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Manage Workflows
            </button>
            <button
              onClick={() => router.push('/admin/settings')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Settings
            </button>
          </div>
        </main>
      </div>
    </div>
  );
} 