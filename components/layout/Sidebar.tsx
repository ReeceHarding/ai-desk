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
        className={`
          group flex items-center px-4 py-3 sm:py-2.5 
          text-base sm:text-sm font-medium rounded-lg
          transition-all duration-200
          active:scale-[0.98]
          ${isActive
            ? 'bg-blue-50 text-blue-700 dark:bg-slate-800 dark:text-blue-400'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800'
          }
        `}
      >
        <span className="relative">
          {children}
          {isActive && (
            <span className="absolute inset-x-1 -bottom-1 h-px bg-gradient-to-r from-blue-500/0 via-blue-500/70 to-blue-500/0"></span>
          )}
        </span>
      </Link>
    );
  };

  return (
    <div className="w-full h-full bg-white dark:bg-slate-900 border-r border-slate-200/50 dark:border-slate-700/50">
      <div className="flex flex-col h-full">
        <div className="flex-1 px-3 py-6 space-y-2">
          <nav className="space-y-1">
            <NavLink href="/dashboard">Dashboard</NavLink>
            <NavLink href="/tickets">Tickets</NavLink>
            
            {isAdmin && (
              <>
                <NavLink href={`/organizations/${orgId}/settings`}>
                  Organization Settings
                </NavLink>
                <NavLink href={`/organizations/${orgId}/kb`}>
                  Knowledge Base
                </NavLink>
              </>
            )}
            
            <NavLink href="/profile">Profile</NavLink>
            <NavLink href="/profile/settings">Settings</NavLink>
          </nav>
        </div>

        <div className="p-4 border-t border-slate-200/50 dark:border-slate-700/50">
          <button
            onClick={handleSignOut}
            className="
              w-full flex items-center justify-center 
              px-4 py-3 sm:py-2.5 
              text-base sm:text-sm font-medium rounded-lg
              text-white
              bg-gradient-to-r from-red-500 to-red-600
              hover:from-red-600 hover:to-red-700
              active:from-red-700 active:to-red-800
              shadow-sm shadow-red-500/10
              hover:shadow-md hover:shadow-red-500/20
              focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2
              transition-all duration-200
              active:scale-[0.98]
            "
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
} 