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

  useEffect(() => {
    const getOrgId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        try {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('org_id')
            .eq('id', user.id)
            .single();
          
          if (profileError) {
            console.error('Error fetching profile:', profileError);
            return;
          }
          
          if (profileData) {
            setOrgId(profileData.org_id);
          }
        } catch (error) {
          console.error('Error:', error);
        }
      }
    };

    getOrgId();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth/signin');
  };

  const NavLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
    const isActive = router.pathname === href || router.pathname.startsWith(`${href}/`);
    return (
      <Link
        href={href}
        className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
          isActive
            ? 'bg-gray-100 text-gray-900'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
        }`}
      >
        {children}
      </Link>
    );
  };

  return (
    <div className="w-64 h-full bg-white border-r border-gray-200">
      <div className="flex flex-col h-full">
        <div className="space-y-4 flex-1 px-3 py-4">
          <nav className="space-y-1">
            <NavLink href="/dashboard">Dashboard</NavLink>
            <NavLink href="/tickets">Tickets</NavLink>
            
            {orgId && (
              <>
                <NavLink href={`/organizations/${orgId}/settings`}>Organization Settings</NavLink>
                <NavLink href={`/organizations/${orgId}/knowledge-base`}>Knowledge Base</NavLink>
              </>
            )}
            
            <NavLink href="/profile">Profile</NavLink>
            <NavLink href="/profile/settings">Settings</NavLink>
          </nav>
        </div>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
} 