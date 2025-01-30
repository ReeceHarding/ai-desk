import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { RefreshCw } from 'lucide-react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  customer: {
    display_name: string;
    email: string;
  };
}

export default function AgentInbox() {
  const router = useRouter();
  const user = useUser();
  const supabase = useSupabaseClient();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push('/auth/signin');
      return;
    }
    fetchTickets();
  }, [user, router]);

  const fetchTickets = async () => {
    try {
      const { data: ticketsData, error } = await supabase
        .from('tickets')
        .select(`
          id,
          subject,
          status,
          priority,
          created_at,
          customer:profiles!tickets_customer_id_fkey(
            display_name,
            email
          )
        `)
        .eq('status', 'open')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(ticketsData || []);
    } catch (err) {
      console.error('Error fetching tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
      case 'solved': return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
      case 'closed': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300';
    }
  };

  if (!user) {
    return null;
  }

  return (
    <AppLayout>
      <Head>
        <title>Agent Inbox - Zendesk</title>
      </Head>

      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Agent Inbox</h1>
          <Button
            onClick={() => router.push('/tickets/new')}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            Create New Ticket
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
            <div className="text-center">
              <p className="text-slate-500 dark:text-slate-400">No open tickets in your inbox</p>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 shadow overflow-hidden sm:rounded-lg">
            <ul className="divide-y divide-slate-200 dark:divide-slate-700">
              {tickets.map((ticket) => (
                <li key={ticket.id}>
                  <div
                    className="px-4 py-4 sm:px-6 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer"
                    onClick={() => router.push(`/agent/tickets/${ticket.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <p className="text-sm font-medium text-blue-600 dark:text-blue-400 truncate">
                          {ticket.subject}
                        </p>
                        <span className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(ticket.status)}`}>
                          {ticket.status}
                        </span>
                      </div>
                      <div className="ml-2 flex-shrink-0 flex">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {new Date(ticket.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="flex items-center text-sm text-slate-500 dark:text-slate-400">
                        <span>From: {ticket.customer.display_name}</span>
                        <span className="mx-2">•</span>
                        <span>{ticket.customer.email}</span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </AppLayout>
  );
} 
