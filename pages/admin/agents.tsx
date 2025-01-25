import InviteAgentModal from '@/components/InviteAgentModal';
import { Database } from '@/types/supabase';
import { logger } from '@/utils/logger';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';

type Agent = {
  id: string;
  email: string;
  display_name: string;
  role: string;
  created_at: string;
  agentStats?: {
    totalTicketsResponded: number;
    totalFirstResponseTime: number;
    totalTicketsResolved: number;
    totalResolutionTime: number;
    averageHappiness: number;
  };
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const supabase = createClientComponentClient<Database>();

  useEffect(() => {
    loadAgents();
  }, []);

  async function loadAgents() {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .single();

      if (profile?.role !== 'admin') {
        setError('You must be an admin to view this page');
        return;
      }

      const { data, error: agentsError } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['agent', 'admin'])
        .order('created_at', { ascending: false });

      if (agentsError) throw agentsError;

      setAgents(data.map(agent => ({
        ...agent,
        agentStats: agent.extra_json_1?.agentStats
      })));
    } catch (err: any) {
      logger.error('Error loading agents:', { error: err });
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <span className="ml-2">Loading agents...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Manage Agents</h1>
        <button
          onClick={() => setIsInviteModalOpen(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Generate Invite Link
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Agent
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tickets Resolved
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Avg Response Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Avg Happiness
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {agents.map(agent => (
              <tr key={agent.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {agent.display_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {agent.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {agent.role}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {agent.agentStats?.totalTicketsResolved || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {agent.agentStats?.totalFirstResponseTime && agent.agentStats?.totalTicketsResponded
                    ? Math.round(agent.agentStats.totalFirstResponseTime / agent.agentStats.totalTicketsResponded) + ' mins'
                    : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {agent.agentStats?.averageHappiness
                    ? agent.agentStats.averageHappiness.toFixed(1)
                    : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <InviteAgentModal
        isOpen={isInviteModalOpen}
        onClose={() => {
          setIsInviteModalOpen(false);
          loadAgents(); // Refresh the list after inviting
        }}
      />
    </div>
  );
} 
