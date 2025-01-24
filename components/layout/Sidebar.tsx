import { useUserRole } from '@/hooks/useUserRole';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function Sidebar() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const { role } = useUserRole();
  const [orgId, setOrgId] = useState<string | null>(null);
  const isAdmin = role === 'admin' || role === 'super_admin';

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth/signin');
  };

  useEffect(() => {
    const getOrgId = async () => {
      console.log('Sidebar - Current role:', role);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log('Sidebar - Fetching org_id for user:', user.id);
        try {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('org_id')
            .eq('id', user.id)
            .single();
          
          if (profileError) {
            console.log('Sidebar - Error fetching profile:', profileError);
            return;
          }
          
          if (profileData) {
            console.log('Sidebar - Found org_id:', profileData.org_id);
            setOrgId(profileData.org_id);
          } else {
            console.log('Sidebar - No org_id found for user');
          }
        } catch (error) {
          console.error('Sidebar - Error:', error);
        }
      }
    };

    getOrgId();
  }, [supabase, role]);

  console.log('Sidebar - Render state:', { isAdmin, orgId, role });

  return (
    <aside className="w-64 bg-white shadow-lg h-screen flex flex-col">
      <div className="p-4">
        <Link href="/dashboard" className="text-xl font-semibold">
          Zendesk Clone
        </Link>
      </div>
      
      <nav className="flex-1 p-4">
        <div className="space-y-2">
          <Link
            href="/tickets"
            className="block text-gray-700 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-md text-sm font-medium"
          >
            Tickets
          </Link>
          
          {isAdmin && (
            <>
              <Link
                href={`/organizations/${orgId}/settings`}
                className="block text-gray-700 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-md text-sm font-medium"
              >
                Organization Settings
              </Link>
              
              <Link
                href={`/organizations/${orgId}/kb`}
                className="block text-gray-700 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-md text-sm font-medium"
              >
                Knowledge Base
              </Link>
            </>
          )}
          
          <Link
            href="/profile/settings"
            className="block text-gray-700 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-md text-sm font-medium"
          >
            Settings
          </Link>
          
          <Link
            href="/profile"
            className="block text-gray-700 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-md text-sm font-medium"
          >
            Profile
          </Link>
        </div>
      </nav>
      
      <div className="p-4 border-t">
        <button
          onClick={handleSignOut}
          className="w-full bg-red-600 text-white hover:bg-red-700 px-4 py-2 rounded-md text-sm font-medium"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
} 