import { AppLayout } from '@/components/layout/AppLayout';
import { useUserRole } from '@/hooks/useUserRole';
import { Database } from '@/types/supabase';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { BarChart, CheckCircle, Clock } from 'lucide-react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

interface AgentStats {
  totalTickets: number;
  avgResponseTime: number;
  resolutionRate: number;
}

export default function AgentAnalytics() {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();
  const { role, loading: roleLoading } = useUserRole();
  const [stats, setStats] = useState<AgentStats>({
    totalTickets: 0,
    avgResponseTime: 0,
    resolutionRate: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roleLoading && role !== 'agent' && role !== 'admin' && role !== 'super_admin') {
      router.push('/auth/signin');
      return;
    }

    const fetchStats = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get total tickets count
        const { count: totalTickets } = await supabase
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .eq('agent_id', user.id);

        // Get resolved tickets count for resolution rate
        const { count: resolvedTickets } = await supabase
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .eq('agent_id', user.id)
          .eq('status', 'solved');

        // Calculate resolution rate
        const resolutionRate = totalTickets ? (resolvedTickets || 0) / totalTickets * 100 : 0;

        // Get average response time (placeholder for now)
        const avgResponseTime = 0; // This would need actual response time tracking

        setStats({
          totalTickets: totalTickets || 0,
          avgResponseTime,
          resolutionRate
        });
      } catch (error) {
        console.error('Error fetching agent stats:', error);
      } finally {
        setLoading(false);
      }
    };

    if (!roleLoading && (role === 'agent' || role === 'admin' || role === 'super_admin')) {
      fetchStats();
    }
  }, [supabase, role, roleLoading, router]);

  if (roleLoading || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Head>
        <title>Analytics Dashboard - Zendesk</title>
      </Head>

      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track your support performance and metrics
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200/50 p-6 transition-all duration-300 hover:shadow-md">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BarChart className="h-6 w-6 text-blue-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-slate-500 truncate">
                    Total Tickets
                  </dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-slate-900">
                      {stats.totalTickets}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200/50 p-6 transition-all duration-300 hover:shadow-md">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Clock className="h-6 w-6 text-green-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-slate-500 truncate">
                    Avg Response Time
                  </dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-slate-900">
                      {stats.avgResponseTime}min
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200/50 p-6 transition-all duration-300 hover:shadow-md">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="h-6 w-6 text-purple-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-slate-500 truncate">
                    Resolution Rate
                  </dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-slate-900">
                      {stats.resolutionRate.toFixed(1)}%
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200/50 p-6 transition-all duration-300 hover:shadow-md">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Activity</h2>
          <p className="text-slate-500 text-center py-8">
            No recent activity to display
          </p>
        </div>
      </div>
    </AppLayout>
  );
} 
