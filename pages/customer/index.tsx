import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { motion } from 'framer-motion';
import { MessageSquare, Plus, RefreshCw, Ticket } from 'lucide-react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import CustomerHeader from '@/components/CustomerHeader';

interface Ticket {
  id: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

interface Profile {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string;
  org_id: string | null;
}

export default function CustomerDashboard() {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get user profile
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No user found');

        // Get profile data
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError) throw profileError;
        setProfile(profileData);

        // Get user's tickets
        const { data: ticketsData, error: ticketsError } = await supabase
          .from('tickets')
          .select('*')
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false });

        if (ticketsError) throw ticketsError;
        setTickets(ticketsData || []);
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
      case 'solved': return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
      case 'closed': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Head>
        <title>Customer Dashboard - Zendesk</title>
      </Head>

      <CustomerHeader title="Dashboard" />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Welcome back, {profile?.display_name}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              View and manage your support tickets
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <div className="bg-white dark:bg-slate-800 overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Ticket className="h-6 w-6 text-blue-500" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">
                        Active Tickets
                      </dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                          {tickets.filter(t => t.status !== 'closed').length}
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/50 px-5 py-3">
                <div className="text-sm">
                  <button
                    onClick={() => router.push('/customer/tickets')}
                    className="font-medium text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                  >
                    View all tickets
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <MessageSquare className="h-6 w-6 text-green-500" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">
                        Recent Updates
                      </dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                          {tickets.filter(t => t.status === 'pending').length}
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/50 px-5 py-3">
                <div className="text-sm">
                  <button
                    onClick={() => router.push('/customer/tickets?filter=pending')}
                    className="font-medium text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                  >
                    View pending tickets
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Plus className="h-6 w-6 text-indigo-500" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">
                        New Ticket
                      </dt>
                      <dd className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Create a new support ticket
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/50 px-5 py-3">
                <div className="text-sm">
                  <button
                    onClick={() => router.push('/customer/tickets/new')}
                    className="font-medium text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                  >
                    Create ticket
                  </button>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8"
          >
            <h2 className="text-lg font-medium text-slate-900 dark:text-white mb-4">
              Recent Tickets
            </h2>
            <div className="bg-white dark:bg-slate-800 shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                {tickets.slice(0, 5).map((ticket) => (
                  <li key={ticket.id}>
                    <div className="px-4 py-4 sm:px-6 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer"
                         onClick={() => router.push(`/customer/tickets/${ticket.id}`)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <p className="text-sm font-medium text-blue-600 dark:text-blue-400 truncate">
                            {ticket.title}
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
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
} 