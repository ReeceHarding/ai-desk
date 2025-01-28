import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { User } from '@supabase/supabase-js';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';

export default function Dashboard() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
      } else {
        router.push('/auth/signin');
      }
    };
    getUser();
  }, [supabase, router]);

  if (!user) {
    return null;
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
            Welcome back!
          </h1>
          <p className="mt-2 text-sm text-slate-500">{user?.email}</p>
        </div>

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

          {/* Recent Activity Card */}
          <div className="group relative overflow-hidden rounded-xl bg-gradient-to-b from-white to-slate-50 border border-slate-200/50 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-blue-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"/>
            <div className="relative p-6">
              <h3 className="text-lg font-medium text-slate-900 mb-4">Recent Activity</h3>
              <div className="space-y-4">
                <p className="text-sm text-slate-500">No recent activity to show</p>
              </div>
            </div>
          </div>

          {/* Stats Card */}
          <div className="group relative overflow-hidden rounded-xl bg-gradient-to-b from-white to-slate-50 border border-slate-200/50 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-blue-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"/>
            <div className="relative p-6">
              <h3 className="text-lg font-medium text-slate-900 mb-4">Overview</h3>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-slate-500">Open Tickets</dt>
                  <dd className="mt-1 text-2xl font-semibold text-slate-900">0</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-500">Resolved</dt>
                  <dd className="mt-1 text-2xl font-semibold text-slate-900">0</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
} 