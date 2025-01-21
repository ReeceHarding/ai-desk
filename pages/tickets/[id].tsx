import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { Database } from '@/types/supabase';
import { TicketInterface } from '@/components/ticket-interface';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';
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

  const supabase = useSupabaseClient<Database>();
  const user = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady || !user) return;

    const ticketId = Array.isArray(router.query.id) ? router.query.id[0] : router.query.id;
    if (!ticketId) {
      router.push('/tickets');
      return;
    }

    async function fetchTicket() {
      const { data: ticketData, error: ticketError } = await supabase
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
        .eq('id', ticketId as string)
        .single();

      if (ticketError) {
        console.error('Error fetching ticket:', ticketError);
        return;
      }

      if (ticketData) {
        const typedTicket: Ticket = {
          ...ticketData,
          customer: ticketData.customer as Profile,
          organization: ticketData.organization as Organization,
        };
        setTicket(typedTicket);
      }

      setLoading(false);
    }

    fetchTicket();
  }, [router.isReady, router.query.id, user, supabase]);

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
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-white p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <Skeleton className="h-12 w-full" />
          <div className="grid grid-cols-3 gap-8">
            <div className="col-span-2 space-y-4">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h1 className="text-2xl font-semibold">Ticket not found</h1>
          <Button
            onClick={() => router.push('/tickets')}
            className="inline-flex items-center gap-2"
          >
            Back to tickets
          </Button>
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