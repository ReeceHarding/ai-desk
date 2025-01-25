import { Database } from '@/types/supabase';
import { createClientComponentClient, createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import { GetServerSideProps } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

type Organization = Database['public']['Tables']['organizations']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

interface AgentStats {
  totalTicketsResponded: number;
  totalFirstResponseTime: number;
  totalTicketsResolved: number;
  totalResolutionTime: number;
}

interface Props {
  organization: Pick<Organization, 'id' | 'name'> & {
    public_mode: boolean;
  };
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
    .select('id, name, public_mode')
    .eq('id', id)
    .single();

  if (!organization) {
    return {
      notFound: true,
    };
  }

  // Verify user is an admin
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', organization.id)
    .eq('user_id', session.user.id)
    .single();

  if (!membership || membership.role !== 'admin') {
    return {
      redirect: {
        destination: '/403',
        permanent: false,
      },
    };
  }

  return {
    props: {
      organization,
    },
  };
};

export default function AdminDashboard({ organization }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [agents, setAgents] = useState<(Profile & { stats: AgentStats })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAgentStats = async () => {
      const supabase = createClientComponentClient<Database>();
      
      // Get all agents for this organization
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
      setLoading(false);
    };

    fetchAgentStats();
  }, [organization.id]);

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
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
                        <td className="px-6 py-4 whitespace-nowrap">{getAgentDisplayName(agent)}</td>
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

      case 'agents':
        return (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Manage Agents</h2>
              <button
                onClick={() => {/* TODO: Implement invite agent */}}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Invite Agent
              </button>
            </div>
            <div className="space-y-4">
              {agents.map((agent) => (
                <div key={agent.id} className="border rounded-lg p-4 flex justify-between items-center">
                  <div>
                    <h3 className="font-medium">{getAgentDisplayName(agent)}</h3>
                    <p className="text-sm text-gray-500">{agent.email}</p>
                  </div>
                  <button
                    onClick={() => {/* TODO: Implement remove agent */}}
                    className="text-red-500 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        );

      case 'settings':
        return (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-6">Organization Settings</h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-2">Public Mode</h3>
                <p className="text-gray-600 mb-2">
                  When enabled, anyone can submit tickets without an invitation.
                </p>
                <button
                  onClick={() => {/* TODO: Implement toggle public mode */}}
                  className={`px-4 py-2 rounded ${
                    organization.public_mode
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {organization.public_mode ? 'Enabled' : 'Disabled'}
                </button>
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
        <h1 className="text-2xl font-bold">{organization.name} Admin Dashboard</h1>
        <Link
          href={`/organizations/${organization.id}/dashboard`}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Back to Dashboard
        </Link>
      </div>

      <div className="flex gap-8">
        {/* Sidebar */}
        <div className="w-64">
          <div className="bg-white shadow rounded-lg p-4">
            <nav className="space-y-2">
              <button
                onClick={() => setActiveTab('overview')}
                className={`w-full text-left px-4 py-2 rounded ${
                  activeTab === 'overview' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('agents')}
                className={`w-full text-left px-4 py-2 rounded ${
                  activeTab === 'agents' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                Agents
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`w-full text-left px-4 py-2 rounded ${
                  activeTab === 'settings' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                Settings
              </button>
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

// Helper function to get agent display name
function getAgentDisplayName(agent: Profile): string {
  return agent.display_name || agent.email || 'Unnamed Agent';
} 