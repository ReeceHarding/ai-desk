import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { Database } from '@/types/supabase';
import { TicketInterface } from '@/components/ticket-interface';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

export default function TicketPage() {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [isStarred, setIsStarred] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = useSupabaseClient<Database>();
  const user = useUser();
  const router = useRouter();

  const fetchTicket = useCallback(async () => {
    try {
      const id = Array.isArray(router.query.id) ? router.query.id[0] : router.query.id;
      if (!id) return;

      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          customer:profiles!tickets_customer_id_fkey (
            display_name,
            email,
            avatar_url
          ),
          organization:organizations!tickets_org_id_fkey (
            name
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      
      if (data) {
        const typedTicket: Ticket = {
          ...data,
          customer: data.customer as Profile,
          organization: data.organization as Organization,
        };
        setTicket(typedTicket);
      } else {
        setError('Ticket not found');
      }
    } catch (err) {
      console.error('Error fetching ticket:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch ticket');
    } finally {
      setLoading(false);
    }
  }, [router.query.id, supabase]);

  useEffect(() => {
    if (router.query.id) {
      fetchTicket();
    }
  }, [router.query.id, fetchTicket]);

  const handleStatusChange = async (newStatus: Ticket['status']) => {
    if (!ticket || !user) return;

    try {
      const { error } = await supabase
        .from('tickets')
        .update({ status: newStatus })
        .eq('id', ticket.id);

      if (error) throw error;

      setTicket({ ...ticket, status: newStatus });
    } catch (error) {
      console.error('Error updating ticket status:', error);
    }
  };

  const handlePriorityChange = async (newPriority: Ticket['priority']) => {
    if (!ticket || !user) return;

    try {
      const { error } = await supabase
        .from('tickets')
        .update({ priority: newPriority })
        .eq('id', ticket.id);

      if (error) throw error;

      setTicket({ ...ticket, priority: newPriority });
    } catch (error) {
      console.error('Error updating ticket priority:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-white p-8 animate-fade-in">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center space-x-4 mb-8 animate-pulse">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-48" />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="space-y-4">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="bg-slate-800/50 rounded-lg p-6 space-y-4">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-24 w-full" />
              </div>
              <div className="bg-slate-800/50 rounded-lg p-6 space-y-4">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-16 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-white">
        <div className="max-w-7xl mx-auto p-8">
          <Button
            onClick={() => router.push('/tickets')}
            variant="ghost"
            className="mb-8 text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to tickets
          </Button>
          
          <div className="flex flex-col items-center justify-center space-y-6 animate-fade-in">
            <div className="rounded-full bg-red-500/10 p-4">
              <AlertCircle className="h-12 w-12 text-red-500" />
            </div>
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-semibold">
                {error || 'Ticket not found'}
              </h1>
              <p className="text-slate-400 max-w-md mx-auto">
                We couldn&apos;t find the ticket you&apos;re looking for. It may have been deleted or you may not have permission to view it.
              </p>
            </div>
            <Button
              onClick={() => router.push('/tickets')}
              className="bg-white/10 hover:bg-white/20 text-white"
            >
              View all tickets
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TicketInterface
      ticket={ticket}
      onStatusChange={handleStatusChange}
      onPriorityChange={handlePriorityChange}
      isStarred={isStarred}
      onStarToggle={() => setIsStarred(!isStarred)}
      isSubscribed={isSubscribed}
      onSubscribeToggle={() => setIsSubscribed(!isSubscribed)}
    />
  );
} 