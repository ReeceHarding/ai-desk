import { AppLayout } from '@/components/layout/AppLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { Database } from '@/types/supabase';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

type Profile = {
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

type Organization = {
  name: string | null;
};

type Ticket = Database['public']['Tables']['tickets']['Row'] & {
  customer: Profile | null;
  organization: Organization | null;
};

type RealtimePayload = {
  commit_timestamp: string;
  errors: null | string[];
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: { [key: string]: any };
  old: { [key: string]: any };
  schema: string;
  table: string;
};

export default function TicketPage() {
  const router = useRouter();
  const { id } = router.query;
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = useSupabaseClient<Database>();

  useEffect(() => {
    // Check user role and redirect accordingly
    const checkRoleAndRedirect = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/auth/signin');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (!profile) {
          throw new Error('Profile not found');
        }

        // Redirect based on role
        switch (profile.role) {
          case 'customer':
            router.push(`/customer/tickets/${id}`);
            break;
          case 'agent':
          case 'admin':
          case 'super_admin':
            router.push(`/agent/tickets/${id}`);
            break;
          default:
            router.push('/auth/signin');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to check user role');
        setIsLoading(false);
      }
    };

    if (id) {
      checkRoleAndRedirect();
    }
  }, [id]);

  // Show loading state while redirecting
  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-4">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-32 w-full" />
        </div>
      </AppLayout>
    );
  }

  // Show error if something went wrong
  if (error) {
    return (
      <AppLayout>
        <div className="p-4 text-red-500">
          {error}
        </div>
      </AppLayout>
    );
  }

  // The rest of the component won't render as we'll be redirected
  return null;
} 