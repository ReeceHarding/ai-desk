import React, { ReactNode } from 'react';
import { useRouter } from 'next/router';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';
import { useUserRole } from '@/hooks/useUserRole';
import { Toaster } from '@/components/ui/toaster';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const { role } = useUserRole();
  const isAdmin = role === 'admin' || role === 'super_admin';

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth/signin');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-xl font-semibold">
                Zendesk Clone
              </Link>
              <div className="ml-10 flex items-center space-x-4">
                <Link
                  href="/tickets"
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Tickets
                </Link>
                {isAdmin && (
                  <Link
                    href={`/organizations/${router.query.org_id}/settings`}
                    className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Organization Settings
                  </Link>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/profile/settings"
                className="bg-white text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-md text-sm font-medium border"
              >
                Settings
              </Link>
              <Link
                href="/profile"
                className="bg-white text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-md text-sm font-medium border"
              >
                Profile
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
      
      <Toaster />
    </div>
  );
} 