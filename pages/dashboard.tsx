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
        <div className="px-4 py-6 sm:px-0">
          <p>Loading...</p>
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  return (
    <AppLayout>
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-4">
          <h2 className="text-2xl font-bold">Welcome, {user?.email}</h2>
        </div>
        <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 flex items-center justify-center">
          <p className="text-gray-500">Your dashboard content will appear here</p>
        </div>
      </div>
    </AppLayout>
  );
} 