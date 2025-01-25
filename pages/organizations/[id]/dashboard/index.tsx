import { Database } from '@/types/supabase';
import { createClientComponentClient, createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

type Ticket = Database['public']['Tables']['tickets']['Row'];
type Organization = Database['public']['Tables']['organizations']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

interface AgentStats {
  totalTicketsResponded: number;
  totalFirstResponseTime: number;
  totalTicketsResolved: number;
  totalResolutionTime: number;
}

interface Props {
  organization: {
    id: string;
    name: string;
    public_mode: boolean;
    sla_tier: string;
  };
  userRole: string;
}

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const supabase = createPagesServerClient<Database>(context);
  const { id } = context.params || {};

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return {
      redirect: {
        destination: '/auth/signin',
        permanent: false,
      },
    };
  }

  // Get organization details
  const { data: organization } = await supabase
    .from('organizations')
    .select('id, name, public_mode, sla_tier')
    .eq('id', id)
    .single();

  if (!organization) {
    return {
      notFound: true,
    };
  }

  // Get user's role in this organization
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', organization.id)
    .eq('user_id', session.user.id)
    .single();

  // If not a member or customer, show 403
  if (!membership) {
    return {
      redirect: {
        destination: '/403',
        permanent: false,
      },
    };
  }

  // If customer, redirect to their tickets page
  if (membership.role === 'customer') {
    return {
      redirect: {
        destination: '/tickets',
        permanent: false,
      },
    };
  }

  return {
    props: {
      organization: {
        id: organization.id,
        name: organization.name,
        public_mode: organization.public_mode,
        sla_tier: organization.sla_tier,
      },
      userRole: membership.role,
    },
  };
};

export default function OrganizationDashboard({ organization, userRole }: Props) {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [agents, setAgents] = useState<(Profile & { stats: AgentStats })[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tickets');
  const [inviteEmail, setInviteEmail] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClientComponentClient<Database>();
      
      // Fetch tickets
      const { data: ticketsData } = await supabase
        .from('tickets')
        .select()
        .eq('org_id', organization.id)
        .order('created_at', { ascending: false });

      if (ticketsData) {
        setTickets(ticketsData);
      }

      // If admin, fetch agent data
      if (userRole === 'admin') {
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
      
      setLoading(false);
    };

    fetchData();
  }, [organization.id, userRole]);

  const handleInviteAgent = async () => {
    if (!inviteEmail) return;

    const supabase = createClientComponentClient<Database>();
    
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
  };

  const renderContent = () => {
    switch (activeTab) {
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
                      const supabase = createClientComponentClient<Database>();
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
                <div className="border rounded-lg p-4">
                  <h3 className="text-lg font-medium mb-2">Public Mode</h3>
                  <p className="text-2xl font-bold">{organization.public_mode ? 'Enabled' : 'Disabled'}</p>
                </div>
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

  if (loading) {
    return <div className="container mx-auto px-4 py-8">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">{organization.name} Dashboard</h1>
      </div>

      <div className="mb-6">
        <nav className="flex space-x-4">
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