import { logger } from '@/utils/logger';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

interface DashboardStats {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  averageResponseTime: number;
  totalAgents: number;
  totalCustomers: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    const fetchDashboardStats = async () => {
      setIsLoading(true);
      setError(null);

      try {
        logger.info('[ADMIN_DASHBOARD] Fetching dashboard stats');

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          logger.error('[ADMIN_DASHBOARD] Auth error:', { error: userError });
          setError('Could not verify your identity');
          return;
        }

        // Get user's organization ID
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('org_id')
          .eq('id', user.id)
          .single();

        if (profileError || !profile?.org_id) {
          logger.error('[ADMIN_DASHBOARD] Profile error:', { error: profileError });
          setError('Could not find your organization');
          return;
        }

        // Fetch total tickets
        const { count: totalTickets, error: ticketsError } = await supabase
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', profile.org_id);

        if (ticketsError) {
          logger.error('[ADMIN_DASHBOARD] Tickets count error:', { error: ticketsError });
          setError('Failed to fetch ticket statistics');
          return;
        }

        // Fetch open tickets
        const { count: openTickets, error: openError } = await supabase
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', profile.org_id)
          .eq('status', 'open');

        if (openError) {
          logger.error('[ADMIN_DASHBOARD] Open tickets error:', { error: openError });
          setError('Failed to fetch open tickets');
          return;
        }

        // Fetch resolved tickets
        const { count: resolvedTickets, error: resolvedError } = await supabase
          .from('tickets')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', profile.org_id)
          .eq('status', 'resolved');

        if (resolvedError) {
          logger.error('[ADMIN_DASHBOARD] Resolved tickets error:', { error: resolvedError });
          setError('Failed to fetch resolved tickets');
          return;
        }

        // Fetch total agents
        const { count: totalAgents, error: agentsError } = await supabase
          .from('organization_members')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', profile.org_id)
          .eq('role', 'agent');

        if (agentsError) {
          logger.error('[ADMIN_DASHBOARD] Agents count error:', { error: agentsError });
          setError('Failed to fetch agent statistics');
          return;
        }

        // Fetch total customers
        const { count: totalCustomers, error: customersError } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', profile.org_id)
          .eq('role', 'customer');

        if (customersError) {
          logger.error('[ADMIN_DASHBOARD] Customers count error:', { error: customersError });
          setError('Failed to fetch customer statistics');
          return;
        }

        // Calculate average response time (placeholder for now)
        const averageResponseTime = 0; // This would need actual calculation logic

        setStats({
          totalTickets: totalTickets || 0,
          openTickets: openTickets || 0,
          resolvedTickets: resolvedTickets || 0,
          averageResponseTime,
          totalAgents: totalAgents || 0,
          totalCustomers: totalCustomers || 0
        });

        logger.info('[ADMIN_DASHBOARD] Stats fetched successfully');
      } catch (err) {
        logger.error('[ADMIN_DASHBOARD] Unexpected error:', { error: err });
        setError('An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardStats();
  }, [supabase]);

  const handleInviteAgent = () => {
    router.push('/admin/invite-agent');
  };

  const handleManageWorkflows = () => {
    router.push('/admin/workflows');
  };

  const handleSettings = () => {
    router.push('/admin/settings');
  };

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
        <header>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold leading-tight text-gray-900">
              Admin Dashboard
            </h1>
          </div>
        </header>
        <main>
          <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
            {/* Stats Grid */}
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Total Tickets
                        </dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-gray-900">
                            {stats?.totalTickets}
                          </div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Average Response Time
                        </dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-gray-900">
                            {stats?.averageResponseTime}m
                          </div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Total Agents
                        </dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-gray-900">
                            {stats?.totalAgents}
                          </div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-8">
              <h2 className="text-lg leading-6 font-medium text-gray-900">
                Quick Actions
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <button
                  onClick={handleInviteAgent}
                  className="relative block w-full border-2 border-gray-300 border-dashed rounded-lg p-6 text-center hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  <span className="mt-2 block text-sm font-medium text-gray-900">
                    Invite Agent
                  </span>
                </button>

                <button
                  onClick={handleManageWorkflows}
                  className="relative block w-full border-2 border-gray-300 border-dashed rounded-lg p-6 text-center hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                  </svg>
                  <span className="mt-2 block text-sm font-medium text-gray-900">
                    Manage Workflows
                  </span>
                </button>

                <button
                  onClick={handleSettings}
                  className="relative block w-full border-2 border-gray-300 border-dashed rounded-lg p-6 text-center hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="mt-2 block text-sm font-medium text-gray-900">
                    Settings
                  </span>
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
} 