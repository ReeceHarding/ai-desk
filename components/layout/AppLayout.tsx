import { Toaster } from '@/components/ui/toaster';
import { useUserRole } from '@/hooks/useUserRole';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/router';
import { ReactNode, useEffect, useState } from 'react';
import { useThreadPanel } from '../../contexts/ThreadPanelContext';
import Sidebar from './Sidebar';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const { role } = useUserRole();
  const [orgId, setOrgId] = useState<string | null>(null);
  const isAdmin = role === 'admin' || role === 'super_admin';
  const { isThreadPanelOpen } = useThreadPanel();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth/signin');
  };

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [router.pathname]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 font-sans antialiased">
      {/* Header */}
      <header className="fixed top-0 z-30 w-full backdrop-blur-lg bg-white/80 border-b border-slate-200/50 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Mobile menu button */}
            <button
              type="button"
              className="md:hidden inline-flex items-center justify-center p-2 rounded-lg text-slate-500 hover:text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
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

            {/* Logo */}
            <div className="flex-1 flex items-center justify-center md:justify-start">
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
          className={`fixed inset-y-0 left-0 transform ${
            router.pathname.includes('/organizations') || 
            router.pathname.includes('/settings') ||
            router.pathname.startsWith('/tickets') ||
            router.pathname.startsWith('/kb') ? 'md:translate-x-0' : 
            isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          } md:relative md:translate-x-0 transition-transform duration-300 ease-in-out z-40 bg-white w-72 md:w-64 top-16 border-r border-slate-200/50 shadow-lg md:shadow-none`}
        >
          <div className="h-full overflow-y-auto">
            <Sidebar />
          </div>
        </div>

        {/* Backdrop for mobile menu */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
        
        {/* Main content */}
        <main 
          className={`flex-1 relative overflow-y-auto focus:outline-none
            ${isMobileMenuOpen ? 'md:ml-64' : ''}
            ${isThreadPanelOpen ? 'lg:mr-[400px]' : ''}
            bg-gradient-to-b from-white to-slate-50 
            px-4 sm:px-6 lg:px-8 py-6 sm:py-8
            transition-all duration-300
          `}
        >
          <div className="max-w-7xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200/50 p-4 sm:p-6 lg:p-8 transition-all duration-300 hover:shadow-md">
              {children}
            </div>
          </div>
        </main>

        {/* Thread Panel - slide in from right on mobile */}
        <div 
          className={`fixed inset-y-0 right-0 w-full sm:w-[400px] bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${
            isThreadPanelOpen ? 'translate-x-0' : 'translate-x-full'
          } top-16 border-l border-slate-200/50 z-20`}
        >
          {/* Thread panel content */}
        </div>

        {/* Backdrop for thread panel on mobile */}
        {isThreadPanelOpen && (
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-10 lg:hidden"
            onClick={() => router.push('/tickets')}
          />
        )}
      </div>

      <Toaster />
    </div>
  );
} 