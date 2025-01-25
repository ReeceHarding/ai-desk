import { AdminDashboard } from '@/components/admin/AdminDashboard';
import InviteAgentModal from '@/components/InviteAgentModal';
import { Database } from '@/types/supabase';
import { logger } from '@/utils/logger';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { User } from '@supabase/supabase-js';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Ticket = Database['public']['Tables']['tickets']['Row'];

interface AgentStats {
  totalTicketsResponded: number;
  totalFirstResponseTime: number;
  totalTicketsResolved: number;
  totalResolutionTime: number;
}

export default function Dashboard() {
  const supabase = createClientComponentClient<Database>();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [organization, setOrganization] = useState<{
    id: string;
    name: string;
    public_mode: boolean;
    sla_tier: string;
  } | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [agents, setAgents] = useState<(Profile & { stats: AgentStats })[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const getUser = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/auth/signin');
        return;
      }

      setUser(session.user);

      // Get user's organization and role
      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', session.user.id)
        .single();

      if (profile?.org_id) {
        // Get organization details
        const { data: org } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', profile.org_id)
          .single();

        if (org) {
          setOrganization({
            id: org.id,
            name: org.name,
            public_mode: org.public_mode,
            sla_tier: org.sla_tier
          });

          // Get user's role
          const { data: membership } = await supabase
            .from('organization_members')
            .select('role')
            .eq('organization_id', org.id)
            .eq('user_id', session.user.id)
            .single();

          if (membership) {
            setUserRole(membership.role);
          }

          // Fetch tickets
          const { data: ticketsData } = await supabase
            .from('tickets')
            .select()
            .eq('org_id', org.id)
            .order('created_at', { ascending: false });

          if (ticketsData) {
            setTickets(ticketsData);
          }

          // If admin, fetch agent data
          if (membership?.role === 'admin') {
            const { data: members } = await supabase
              .from('organization_members')
              .select('user_id')
              .eq('organization_id', org.id)
              .eq('role', 'agent');

            if (members) {
              const agentDetails = await Promise.all(
                members.map(async (member) => {
                  const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', member.user_id)
                    .single();

                  return {
                    ...profile,
                    stats: profile?.extra_json_1?.agentStats || {
                      totalTicketsResponded: 0,
                      totalFirstResponseTime: 0,
                      totalTicketsResolved: 0,
                      totalResolutionTime: 0,
                    },
                  };
                })
              );
              setAgents(agentDetails);
            }
          }
        }
      }
    } catch (err) {
      logger.error('Session check error:', err);
      router.push('/auth/signin');
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    getUser();
  }, [getUser]);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        if (userRole === 'admin') {
          return <AdminDashboard />;
        }
        return (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Quick Actions Card */}
            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Quick Actions</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => router.push('/tickets/new')}
                    className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Create New Ticket
                  </button>
                  {userRole === 'admin' && (
                    <button
                      onClick={() => setShowInviteModal(true)}
                      className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-500 hover:bg-blue-600"
                    >
                      Invite Agent
                    </button>
                  )}
                  <button
                    onClick={() => router.push('/profile')}
                    className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    View Profile
                  </button>
                </div>
              </div>
            </div>

            {/* Stats Card */}
            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Overview</h3>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Open Tickets</dt>
                    <dd className="mt-1 text-2xl font-semibold text-gray-900">
                      {tickets.filter(t => t.status === 'open').length}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Solved</dt>
                    <dd className="mt-1 text-2xl font-semibold text-gray-900">
                      {tickets.filter(t => t.status === 'solved').length}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Organization Info */}
            {organization && (
              <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                <div className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Organization</h3>
                  <dl className="space-y-4">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Name</dt>
                      <dd className="mt-1 text-sm text-gray-900">{organization.name}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">SLA Tier</dt>
                      <dd className="mt-1 text-sm text-gray-900 capitalize">{organization.sla_tier}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Public Mode</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {organization.public_mode ? 'Enabled' : 'Disabled'}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
            {userRole === 'admin' && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Invite Agent
              </button>
            )}
          </div>
          <div className="mt-8">
            {renderContent()}
          </div>
        </div>
      </div>

      <InviteAgentModal
        isOpen={showInviteModal}
        onClose={() => {
          setShowInviteModal(false);
          getUser(); // Refresh data after inviting
        }}
      />
    </div>
  );
} 