import { StatsOverview } from '@/components/dashboard/stats-overview';
import { useUserRole } from '@/hooks/useUserRole';
import { fetchDashboardStats, type DashboardStats } from '@/utils/dashboardStats';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { AlertTriangle, Clock, Ticket, Users } from 'lucide-react';
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
        
        {/* Stats Overview */}
        <StatsOverview stats={stats} loading={loading} />

        {/* Quick Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Open Tickets</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {stats?.ticketStats.open || 0}
                </p>
              </div>
              <div className="bg-blue-100 rounded-full p-3">
                <Ticket className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">High Priority</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {stats?.ticketStats.highPriority || 0}
                </p>
              </div>
              <div className="bg-red-100 rounded-full p-3">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Response Time</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {stats?.ticketStats.avgResponseHours || 0}h
                </p>
              </div>
              <div className="bg-orange-100 rounded-full p-3">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Agents</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {stats?.userStats.totalAgents || 0}
                </p>
              </div>
              <div className="bg-green-100 rounded-full p-3">
                <Users className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Secondary Stats Grid */}
        {showDetailedStats && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Quick Actions Card */}
            <div className="group relative overflow-hidden rounded-xl bg-gradient-to-b from-white to-slate-50 border border-slate-200/50 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-blue-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"/>
              <div className="relative p-6">
                <h3 className="text-lg font-medium text-slate-900 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => router.push('/tickets/new')}
                    className="w-full flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-sm shadow-blue-500/10 hover:shadow-md hover:shadow-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
                  >
                    Create New Ticket
                  </button>
                  <button
                    onClick={() => router.push('/profile')}
                    className="w-full flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-lg text-slate-700 bg-white border border-slate-200/50 hover:bg-slate-50 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
                  >
                    View Profile
                  </button>
                </div>
              </div>
            </div>

            {/* Performance Card */}
            <div className="group relative overflow-hidden rounded-xl bg-gradient-to-b from-white to-slate-50 border border-slate-200/50 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-blue-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"/>
              <div className="relative p-6">
                <h3 className="text-lg font-medium text-slate-900 mb-4">Performance</h3>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Total Tickets</dt>
                    <dd className="mt-1 text-2xl font-semibold text-slate-900">
                      {loading ? '-' : Object.values(stats?.ticketStats.byStatus || {}).reduce((a, b) => a + b, 0)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Solved</dt>
                    <dd className="mt-1 text-2xl font-semibold text-slate-900">
                      {loading ? '-' : stats?.ticketStats.solved}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Team Stats Card */}
            <div className="group relative overflow-hidden rounded-xl bg-gradient-to-b from-white to-slate-50 border border-slate-200/50 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-blue-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"/>
              <div className="relative p-6">
                <h3 className="text-lg font-medium text-slate-900 mb-4">Team</h3>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Agents</dt>
                    <dd className="mt-1 text-2xl font-semibold text-slate-900">
                      {loading ? '-' : stats?.userStats.totalAgents}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-slate-500">Customers</dt>
                    <dd className="mt-1 text-2xl font-semibold text-slate-900">
                      {loading ? '-' : stats?.userStats.totalCustomers}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
} 