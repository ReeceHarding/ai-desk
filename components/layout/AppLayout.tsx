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

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      
      {/* Main content area with dynamic width */}
      <main className={`flex-1 overflow-auto transition-all duration-300 ${
        isThreadPanelOpen ? 'mr-[400px]' : ''
      }`}>
        <div className="h-full">
          {children}
        </div>
      </main>

      {/* Fixed thread panel */}
      <div className={`fixed top-0 right-0 h-screen w-[400px] bg-white shadow-lg transform transition-transform duration-300 ${
        isThreadPanelOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        {/* Thread panel content goes here */}
      </div>

      <Toaster />
    </div>
  );
} 