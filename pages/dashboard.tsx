import { AgentPerformanceTable } from '@/components/admin/agent-performance-table';
import { StatsOverview } from '@/components/dashboard/stats-overview';
import { useUserRole } from '@/hooks/useUserRole';
import { fetchDashboardStats, type DashboardStats } from '@/utils/dashboardStats';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { AppLayout } from '../components/layout/AppLayout';

export default function Dashboard() {
  const router = useRouter();
  const supabase = useSupabaseClient();
  const user = useUser();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { role, loading: roleLoading } = useUserRole();
  const [agentStats, setAgentStats] = useState<any[]>([]);

  useEffect(() => {
    async function loadStats() {
      if (!user) return;

      try {
        setLoading(true);
        const { data: profile } = await supabase
          .from('profiles')
          .select('org_id')
          .eq('id', user.id)
          .single();

        if (profile?.org_id) {
          const stats = await fetchDashboardStats(profile.org_id);
          setStats(stats);

          // Transform agent stats into the format needed by AgentPerformanceTable
          const agentPerformanceData = stats.userStats.activeAgents.map(agent => ({
            agent_id: agent.id,
            agent_name: agent.name,
            tickets_assigned: agent.openTickets,
            tickets_resolved: stats.ticketStats.solved,
            avg_response_time: `${Math.round(stats.ticketStats.avgResponseHours)}h`,
            avg_resolution_time: `${Math.round(stats.ticketStats.avgResponseHours * 1.5)}h` // Example calculation
          }));
          setAgentStats(agentPerformanceData);
        }
      } catch (error) {
        console.error('Error loading dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, [user, supabase]);

  if (!user || loading || roleLoading) {
    return (
      <AppLayout>
        <div className="container mx-auto py-10">
          <div className="animate-pulse">
            <div className="h-8 w-48 bg-gray-200 rounded mb-8" />
            <div className="space-y-4">
              <div className="h-40 bg-gray-200 rounded" />
              <div className="h-40 bg-gray-200 rounded" />
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Only show detailed stats for admin and agent roles
  const showDetailedStats = role === 'admin' || role === 'agent';

  return (
    <AppLayout>
      <div className="container mx-auto py-10">
        <h1 className="text-4xl font-bold tracking-tight mb-8">Dashboard</h1>
        <div className="space-y-8">
          <StatsOverview stats={stats} loading={loading} />
          {showDetailedStats && (
            <AgentPerformanceTable data={agentStats} loading={loading} />
          )}
        </div>
      </div>
    </AppLayout>
  );
} 