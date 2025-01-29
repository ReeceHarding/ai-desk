import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { motion } from 'framer-motion';
import { RefreshCw, Settings, Ticket, Users } from 'lucide-react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

interface AdminStats {
  totalUsers: number;
  totalTickets: number;
  totalOrganizations: number;
}

interface Profile {
  id: string;
  email: string;
  display_name: string;
  role: string;
}

export default function AdminDashboard() {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No user found');

        // Get admin's profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError) throw profileError;
        setProfile(profileData);

        // Get total users count
        const { count: usersCount, error: usersError } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        if (usersError) throw usersError;

        // Get total tickets count
        const { count: ticketsCount, error: ticketsError } = await supabase
          .from('tickets')
          .select('*', { count: 'exact', head: true });

        if (ticketsError) throw ticketsError;

        // Get total organizations count
        const { count: orgsCount, error: orgsError } = await supabase
          .from('organizations')
          .select('*', { count: 'exact', head: true });

        if (orgsError) throw orgsError;

        setStats({
          totalUsers: usersCount || 0,
          totalTickets: ticketsCount || 0,
          totalOrganizations: orgsCount || 0,
        });
      } catch (err: any) {
        console.error('Error fetching admin data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase]);

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
        <title>Admin Dashboard - Zendesk</title>
      </Head>

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
              Here's an overview of your system
            </p>
          </motion.div>

          {stats && (
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
                      <Users className="h-6 w-6 text-blue-500" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">
                          Total Users
                        </dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                            {stats.totalUsers}
                          </div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 px-5 py-3">
                  <div className="text-sm">
                    <button
                      onClick={() => router.push('/admin/users')}
                      className="font-medium text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                    >
                      View all users
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Ticket className="h-6 w-6 text-green-500" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">
                          Total Tickets
                        </dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                            {stats.totalTickets}
                          </div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 px-5 py-3">
                  <div className="text-sm">
                    <button
                      onClick={() => router.push('/admin/tickets')}
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
                      <Settings className="h-6 w-6 text-indigo-500" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">
                          Organizations
                        </dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                            {stats.totalOrganizations}
                          </div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 px-5 py-3">
                  <div className="text-sm">
                    <button
                      onClick={() => router.push('/admin/organizations')}
                      className="font-medium text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                    >
                      Manage organizations
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {error && (
            <div className="mt-4 bg-red-50 dark:bg-red-900/50 p-4 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
} 