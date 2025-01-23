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
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('org_members')
          .select('org_id')
          .eq('user_id', user.id)
          .single();
        
        if (data) {
          setOrgId(data.org_id);
        }
      }
    };

    getOrgId();
  }, [supabase]);

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
          
          {isAdmin && orgId && (
            <Link
              href={`/organizations/${orgId}/settings`}
              className="block text-gray-700 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-md text-sm font-medium"
            >
              Organization Settings
            </Link>
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