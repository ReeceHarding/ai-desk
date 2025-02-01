import { Badge } from '@/components/ui/badge';
import { useUserRole } from '@/hooks/useUserRole';
import { Database } from '@/types/supabase';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
    Bell,
    BookOpen,
    Bot,
    LayoutDashboard,
    LogOut,
    Mail,
    Plus,
    Ticket,
    User
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();
  const { role } = useUserRole();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [draftCount, setDraftCount] = useState(0);
  const [latestDraft, setLatestDraft] = useState<{
    subject: string;
    from_name?: string;
    from_address: string;
  } | null>(null);
  const isAdmin = role === 'admin' || role === 'super_admin';
  const isAgent = role === 'agent' || isAdmin;
  const isCustomer = role === 'customer';

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

  useEffect(() => {
    const fetchDrafts = async () => {
      const { data, count } = await supabase
        .from('ticket_email_chats')
        .select('id, subject, from_name, from_address', { count: 'exact' })
        .eq('ai_auto_responded', false)
        .not('ai_draft_response', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);

      setDraftCount(count || 0);
      if (data && data.length > 0) {
        setLatestDraft(data[0]);
      } else {
        setLatestDraft(null);
      }
    };

    fetchDrafts();

    // Subscribe to changes
    const channel = supabase
      .channel('ticket_email_chats')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_email_chats',
          filter: 'ai_auto_responded=eq.false'
        },
        () => {
          fetchDrafts();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const NavLink = ({ href, children, icon: Icon, badge }: { href: string; children: React.ReactNode; icon?: any; badge?: number }) => {
    const isActive = router.pathname === href || router.pathname.startsWith(`${href}/`);
    return (
      <Link
        href={href}
        onClick={() => onNavigate?.()}
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
        <span className="relative flex items-center gap-2 w-full">
          {Icon && <Icon className="h-4 w-4" />}
          <span className="flex-1">{children}</span>
          {badge !== undefined && badge > 0 && (
            <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400">
              {badge}
            </Badge>
          )}
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
            <NavLink href="/dashboard" icon={LayoutDashboard}>Dashboard</NavLink>
            
            {isAgent && (
              <>
                <NavLink href="/ai-drafts" icon={Bot} badge={draftCount}>
                  <div className="flex flex-col w-full">
                    <div className="flex items-center justify-between w-full">
                      <span>AI Drafts</span>
                    </div>
                    {latestDraft && (
                      <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-md">
                        <div className="text-xs text-slate-700 dark:text-slate-300 truncate">
                          <div className="font-medium truncate">{latestDraft.subject || '(No Subject)'}</div>
                          <div className="truncate text-slate-500 dark:text-slate-400">
                            From: {latestDraft.from_name || latestDraft.from_address}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </NavLink>

                <NavLink href={`/organizations/${orgId}/kb`} icon={BookOpen}>
                  Knowledge Base
                </NavLink>
              </>
            )}

            {isCustomer && (
              <NavLink href="/customer/tickets/new" icon={Plus}>Create Ticket</NavLink>
            )}

            <NavLink href="/tickets" icon={Ticket}>Tickets</NavLink>
            
            <NavLink href="/notifications" icon={Bell} badge={draftCount}>
              <div className="flex flex-col w-full">
                <div className="flex items-center justify-between w-full">
                  <span>Notifications</span>
                </div>
                {latestDraft && (
                  <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-md">
                    <div className="text-xs text-slate-700 dark:text-slate-300 truncate">
                      <div className="font-medium truncate">{latestDraft.subject || '(No Subject)'}</div>
                      <div className="truncate text-slate-500 dark:text-slate-400">
                        From: {latestDraft.from_name || latestDraft.from_address}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </NavLink>
            
            <NavLink href="/profile" icon={User}>Profile</NavLink>
            <NavLink href="/profile/settings" icon={Mail}>Connect Gmail</NavLink>
          </nav>
        </div>

        <div className="p-4 border-t border-slate-200/50 dark:border-slate-700/50">
          <button
            onClick={handleSignOut}
            className="
              w-full flex items-center justify-center gap-2
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
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
} 