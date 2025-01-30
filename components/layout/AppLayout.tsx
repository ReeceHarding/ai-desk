import { Toaster } from '@/components/ui/toaster';
import { useUserRole } from '@/hooks/useUserRole';
import { cn } from '@/lib/utils';
import { Database } from '@/types/supabase';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/router';
import { ReactNode, useEffect, useState } from 'react';
import { useThreadPanel } from '../../contexts/ThreadPanelContext';
import { EmailNotifications } from '../notifications/EmailNotifications';
import { BackButton } from '../ui/back-button';
import Sidebar from './Sidebar';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();
  const { role } = useUserRole();
  const [orgId, setOrgId] = useState<string | null>(null);
  const isAdmin = role === 'admin' || role === 'super_admin';
  const { isThreadPanelOpen } = useThreadPanel();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [pendingDraftsCount, setPendingDraftsCount] = useState(0);

  useEffect(() => {
    async function fetchUserOrg() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('org_id')
          .eq('id', user.id)
          .single();
        
        if (profile?.org_id) {
          setOrgId(profile.org_id);
        }
      }
    }
    fetchUserOrg();
  }, [supabase]);

  useEffect(() => {
    const fetchPendingDraftsCount = async () => {
      const { count } = await supabase
        .from('ticket_email_chats')
        .select('*', { count: 'exact', head: true })
        .eq('ai_auto_responded', false)
        .not('ai_draft_response', 'is', null);

      setPendingDraftsCount(count || 0);
    };

    fetchPendingDraftsCount();

    // Subscribe to changes
    const channel = supabase
      .channel('ticket_email_chats_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_email_chats',
          filter: 'ai_auto_responded=eq.false',
        },
        () => {
          fetchPendingDraftsCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [router.pathname]);

  const handleMobileMenuClose = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 font-sans antialiased">
      <EmailNotifications />
      {/* Header */}
      <header className="fixed top-0 z-20 w-full backdrop-blur-lg bg-white/80 border-b border-slate-200/50 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Mobile menu button */}
            <button
              type="button"
              className="lg:hidden inline-flex items-center justify-center p-2 rounded-lg text-slate-500 hover:text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <span className="sr-only">Open main menu</span>
              <svg
                className="block h-6 w-6"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={isMobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
                />
              </svg>
            </button>

            {/* Back button */}
            <div className="flex items-center gap-4">
              <BackButton className="hidden sm:flex" />
              
              {/* Logo */}
              <span className="text-lg sm:text-xl font-semibold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Zendesk Clone
              </span>
            </div>

            {/* User menu */}
            <div className="flex items-center space-x-4">
              {/* Add user menu items here if needed */}
            </div>
          </div>
        </div>
      </header>

      <div className="flex min-h-screen pt-16">
        {/* Sidebar - hidden on mobile unless menu is open */}
        <div 
          className={cn(
            "fixed inset-y-0 left-0 transform lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out z-40",
            "bg-white w-72 lg:w-64 top-16 border-r border-slate-200/50 shadow-lg lg:shadow-none",
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="h-full overflow-y-auto">
            <Sidebar onNavigate={handleMobileMenuClose} />
          </div>
        </div>

        {/* Backdrop for mobile menu */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
        
        {/* Main content */}
        <main 
          className={cn(
            "flex-1 relative overflow-y-auto focus:outline-none",
            "bg-gradient-to-b from-white to-slate-50",
            "px-4 sm:px-6 lg:px-8 py-6 sm:py-8",
            "transition-all duration-300",
            isThreadPanelOpen && "lg:mr-[400px]"
          )}
        >
          <div className="max-w-7xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200/50 p-4 sm:p-6 lg:p-8 transition-all duration-300 hover:shadow-md">
              {children}
            </div>
          </div>
        </main>

        {/* Thread Panel */}
        <div 
          className={cn(
            "fixed inset-y-0 right-0 w-full sm:w-[400px] bg-white shadow-lg transform",
            "transition-transform duration-300 ease-in-out",
            "top-16 border-l border-slate-200/50 z-20",
            isThreadPanelOpen ? "translate-x-0" : "translate-x-full"
          )}
        >
          {/* Thread panel content */}
        </div>

        {/* Backdrop for thread panel on mobile */}
        {isThreadPanelOpen && (
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-10 lg:hidden"
            onClick={() => {
              // Close the thread panel instead of redirecting
              if (typeof window !== 'undefined') {
                const event = new CustomEvent('closeThreadPanel');
                window.dispatchEvent(event);
              }
            }}
          />
        )}
      </div>

      <Toaster />
    </div>
  );
} 