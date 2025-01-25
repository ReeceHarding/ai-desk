import { Toaster } from '@/components/ui/toaster';
import { Database } from '@/types/supabase';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/router';
import { ReactNode, useEffect, useState } from 'react';
import { useThreadPanel } from '../../contexts/ThreadPanelContext';
import Sidebar from './Sidebar';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const user = useUser();
  const supabase = useSupabaseClient<Database>();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [isStaff, setIsStaff] = useState(false);
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

  useEffect(() => {
    if (user) {
      // Check if user is staff
      supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          setIsStaff(data?.role === 'admin' || data?.role === 'agent');
        });
    }
  }, [user, supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth/signin');
  };

  const customerNavItems = [
    {
      title: 'My Tickets',
      href: '/tickets',
      icon: 'Ticket'
    },
    {
      title: 'New Ticket',
      href: '/tickets/new',
      icon: 'Plus'
    },
    {
      title: 'Profile',
      href: '/profile',
      icon: 'User'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="fixed top-0 z-30 w-full bg-white border-b border-gray-200 shadow-sm">
        <div className="px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Mobile menu button */}
            <button
              type="button"
              className="md:hidden inline-flex items-center justify-center p-2 -ml-1 rounded-md text-gray-500 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <span className="sr-only">Open main menu</span>
              {/* Menu icon */}
              <svg
                className="block h-5 w-5 sm:h-6 sm:w-6"
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
              <span className="text-lg sm:text-xl font-semibold text-gray-900">Zendesk Clone</span>
            </div>

            {/* User menu */}
            <div className="flex items-center space-x-1 sm:space-x-3 md:space-x-4">
              {/* Add user menu items here if needed */}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-20 bg-gray-600 bg-opacity-75 transition-opacity md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <div className="flex h-screen pt-14 sm:pt-16">
        {/* Sidebar - hidden on mobile unless menu is open */}
        <div 
          className={`fixed inset-y-0 left-0 transform ${
            isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          } md:relative md:translate-x-0 transition duration-200 ease-in-out z-40 bg-white w-72 md:w-64 top-14 sm:top-16 border-r border-gray-200 shadow-lg md:shadow-none overflow-hidden`}
        >
          <div className="h-full overflow-y-auto">
            <Sidebar />
          </div>
        </div>
        
        {/* Main content */}
        <main 
          className={`flex-1 relative overflow-y-auto focus:outline-none
            ${isMobileMenuOpen ? 'md:ml-64' : ''}
            ${isThreadPanelOpen ? 'lg:mr-[400px]' : ''}
            bg-gray-50 px-3 sm:px-6 lg:px-8 py-4 sm:py-6`}
        >
          <div className="max-w-7xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
              {children}
            </div>
          </div>
        </main>

        {/* Thread Panel - Full width on mobile */}
        <div 
          className={`fixed top-14 sm:top-16 right-0 h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] w-full lg:w-[400px] bg-white shadow-lg transform transition-transform duration-300 ${
            isThreadPanelOpen ? 'translate-x-0' : 'translate-x-full'
          } z-50`}
        >
          {/* Thread panel content */}
        </div>
      </div>

      <Toaster />
    </div>
  );
} 