import { Database } from '@/types/supabase';
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
  const [inviteEmail, setInviteEmail] = useState('');

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
      console.error('Session check error:', err);
      router.push('/auth/signin');
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    getUser();
  }, [getUser]);

  const handleInviteAgent = async () => {
    if (!inviteEmail || !organization) return;

    // First check if the user already exists
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', inviteEmail)
      .single();

    if (existingUser) {
      // Add them directly as an agent
      await supabase.from('organization_members').insert({
        organization_id: organization.id,
        user_id: existingUser.id,
        role: 'agent'
      });
    } else {
      // Create an invitation
      await supabase.from('invitations').insert({
        email: inviteEmail,
        organization_id: organization.id,
        role: 'agent'
      });
    }

    setInviteEmail('');
    setShowInviteModal(false);
    
    // Refresh agent list
    if (organization) {
      const { data: members } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', organization.id)
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
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
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
                      <dt className="text-sm font-medium text-gray-500">Plan</dt>
                      <dd className="mt-1 text-sm text-gray-900">{organization.sla_tier}</dd>
                    </div>
                    {userRole === 'admin' && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Public Mode</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {organization.public_mode ? 'Enabled' : 'Disabled'}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              </div>
            )}
          </div>
        );

      case 'tickets':
        return (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Recent Tickets</h2>
            <div className="space-y-4">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="border p-4 rounded hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push(`/tickets/${ticket.id}`)}
                >
                  <div className="flex justify-between">
                    <h3 className="font-medium">{ticket.subject}</h3>
                    <span className={`px-2 py-1 rounded text-sm ${
                      ticket.status === 'open' ? 'bg-green-100 text-green-800' :
                      ticket.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {ticket.status}
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm mt-1">{ticket.description}</p>
                  <div className="flex justify-between items-center mt-2 text-sm text-gray-500">
                    <span>Created {new Date(ticket.created_at).toLocaleDateString()}</span>
                    <span>#{ticket.id.split('-')[0]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'agents':
        if (userRole !== 'admin') return null;
        return (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Manage Agents</h2>
              <button
                onClick={() => setShowInviteModal(true)}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Invite Agent
              </button>
            </div>
            <div className="space-y-4">
              {agents.map((agent) => (
                <div key={agent.id} className="border rounded-lg p-4 flex justify-between items-center">
                  <div>
                    <h3 className="font-medium">{agent.display_name || agent.email}</h3>
                    <p className="text-sm text-gray-500">{agent.email}</p>
                  </div>
                  <button
                    onClick={async () => {
                      if (!organization) return;
                      await supabase
                        .from('organization_members')
                        .delete()
                        .eq('organization_id', organization.id)
                        .eq('user_id', agent.id);
                      setAgents(agents.filter(a => a.id !== agent.id));
                    }}
                    className="text-red-500 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        );

      case 'overview':
        if (userRole !== 'admin') return null;
        return (
          <div className="space-y-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Organization Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="border rounded-lg p-4">
                  <h3 className="text-lg font-medium mb-2">Total Agents</h3>
                  <p className="text-2xl font-bold">{agents.length}</p>
                </div>
                {organization && (
                  <div className="border rounded-lg p-4">
                    <h3 className="text-lg font-medium mb-2">Public Mode</h3>
                    <p className="text-2xl font-bold">{organization.public_mode ? 'Enabled' : 'Disabled'}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Agent Performance</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agent</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tickets Responded</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Response Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tickets Resolved</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Resolution Time</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {agents.map((agent) => (
                      <tr key={agent.id}>
                        <td className="px-6 py-4 whitespace-nowrap">{agent.display_name || agent.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{agent.stats.totalTicketsResponded}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {agent.stats.totalTicketsResponded > 0
                            ? `${Math.round(agent.stats.totalFirstResponseTime / agent.stats.totalTicketsResponded)} mins`
                            : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">{agent.stats.totalTicketsResolved}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {agent.stats.totalTicketsResolved > 0
                            ? `${Math.round(agent.stats.totalResolutionTime / agent.stats.totalTicketsResolved)} mins`
                            : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600 text-sm font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {organization ? `${organization.name} Dashboard` : 'Welcome back!'}
        </h1>
        <p className="mt-2 text-sm text-gray-600">{user.email}</p>
      </div>

      <div className="mb-6">
        <nav className="flex space-x-4">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-2 rounded-md ${
              activeTab === 'dashboard'
                ? 'bg-gray-900 text-white'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('tickets')}
            className={`px-3 py-2 rounded-md ${
              activeTab === 'tickets'
                ? 'bg-gray-900 text-white'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            Tickets
          </button>
          {userRole === 'admin' && (
            <>
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-3 py-2 rounded-md ${
                  activeTab === 'overview'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('agents')}
                className={`px-3 py-2 rounded-md ${
                  activeTab === 'agents'
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                Agents
              </button>
            </>
          )}
        </nav>
      </div>

      {renderContent()}

      {/* Invite Agent Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Invite Agent</h3>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Enter email address"
              className="w-full p-2 border rounded mb-4"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleInviteAgent}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Send Invitation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 