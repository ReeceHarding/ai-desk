import React, { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/router';
import AppLayout from '../components/layout/AppLayout';

export default function Dashboard() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          router.push('/auth/signin');
          return;
        }

        setUser(session.user);
      } catch (err) {
        console.error('Session check error:', err);
        router.push('/auth/signin');
      } finally {
        setIsLoading(false);
      }
    };

    getUser();
  }, []);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
          <div className="text-center">
            <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-600 text-sm font-medium">Loading your dashboard...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Welcome back!</h1>
          <p className="mt-2 text-sm text-gray-600">{user?.email}</p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Quick Actions Card */}
          <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200 transition duration-150 ease-in-out hover:shadow-md">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Quick Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={() => router.push('/tickets/new')}
                  className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
                >
                  Create New Ticket
                </button>
                <button
                  onClick={() => router.push('/profile')}
                  className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
                >
                  View Profile
                </button>
              </div>
            </div>
          </div>

          {/* Recent Activity Card */}
          <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200 transition duration-150 ease-in-out hover:shadow-md">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
              <div className="space-y-4">
                <p className="text-sm text-gray-500">No recent activity to show</p>
              </div>
            </div>
          </div>

          {/* Stats Card */}
          <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200 transition duration-150 ease-in-out hover:shadow-md">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Overview</h3>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Open Tickets</dt>
                  <dd className="mt-1 text-2xl font-semibold text-gray-900">0</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Resolved</dt>
                  <dd className="mt-1 text-2xl font-semibold text-gray-900">0</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
} 