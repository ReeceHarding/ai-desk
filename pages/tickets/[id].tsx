import AppLayout from '@/components/layout/AppLayout';
import { TicketConversationPanel } from '@/components/ticket-conversation-panel';
import { TicketDetailsPanel } from '@/components/ticket-details-panel';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Database } from '@/types/supabase';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Calendar, ChevronLeft, Clock, MoreHorizontal, Share2 } from 'lucide-react';
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
    if (!id) return;

    const fetchTicket = async () => {
      try {
        const { data, error } = await supabase
          .from('tickets')
          .select('*, customer:profiles(*), organization:organizations(*)')
          .eq('id', id)
          .single();

        if (error) throw error;
        setTicket(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch ticket');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTicket();

    // Subscribe to changes
    const subscription = supabase
      .channel(`ticket-${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tickets',
        filter: `id=eq.${id}`,
      }, async (payload: RealtimePayload) => {
        const { data, error } = await supabase
          .from('tickets')
          .select('*, customer:profiles(*), organization:organizations(*)')
          .eq('id', id)
          .single();

        if (!error && data) {
          setTicket(data);
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [id]);

  const handleStatusChange = async (status: Ticket['status']) => {
    if (!ticket) return;

    try {
      const { error } = await supabase
        .from('tickets')
        .update({ status })
        .eq('id', ticket.id);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to update ticket status:', err);
    }
  };

  const handlePriorityChange = async (priority: Ticket['priority']) => {
    if (!ticket) return;

    try {
      const { error } = await supabase
        .from('tickets')
        .update({ priority })
        .eq('id', ticket.id);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to update ticket priority:', err);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-4 sm:p-8">
          <Skeleton className="h-6 sm:h-8 w-48 sm:w-64 mb-4" />
          <Skeleton className="h-4 w-24 sm:w-32 mb-2" />
          <Skeleton className="h-4 w-36 sm:w-48 mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
            <div className="lg:col-span-2">
              <Skeleton className="h-36 sm:h-48 w-full mb-4 sm:mb-8" />
              <Skeleton className="h-72 sm:h-96 w-full" />
            </div>
            <Skeleton className="h-[calc(100vh-16rem)] w-full" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !ticket) {
    return (
      <AppLayout>
        <div className="p-4 sm:p-8">
          <div className="text-red-500">
            {error || 'Ticket not found'}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-8">
        {/* Back button and header */}
        <div className="mb-6 sm:mb-8">
          <button
            onClick={() => router.push('/tickets')}
            className="group mb-4 inline-flex items-center gap-2 text-base font-medium text-slate-600 hover:text-slate-900 transition-colors duration-200 min-h-[44px] px-2 -ml-2"
          >
            <ChevronLeft className="h-5 w-5 transition-transform duration-200 group-hover:-translate-x-1" />
            Back to tickets
          </button>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                {ticket.subject}
              </h1>
              <p className="mt-1 text-sm sm:text-base text-slate-500">
                Ticket #{ticket.id.split('-')[0]}
              </p>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px] w-full sm:w-auto inline-flex items-center gap-2 px-3 sm:px-4"
              >
                <Share2 className="h-5 w-5" />
                <span className="hidden sm:inline">Share</span>
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-[44px] w-full sm:w-auto inline-flex items-center gap-2 px-3 sm:px-4"
                  >
                    <MoreHorizontal className="h-5 w-5" />
                    <span className="hidden sm:inline">More</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem className="h-11">Edit ticket</DropdownMenuItem>
                  <DropdownMenuItem className="h-11 text-red-500">
                    Delete ticket
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
          {/* Left column - Ticket details and conversation */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-8">
            {/* Ticket details card */}
            <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200/50 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 ring-2 ring-white">
                    <AvatarImage
                      src={ticket.customer?.avatar_url || undefined}
                      alt={ticket.customer?.display_name || ''}
                    />
                    <AvatarFallback className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                      {(ticket.customer?.display_name || 'U')[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-slate-900">
                      {ticket.customer?.display_name || ticket.customer?.email || 'Unknown User'}
                    </div>
                    {ticket.organization?.name && (
                      <div className="text-sm text-slate-500">
                        at {ticket.organization.name}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:ml-auto">
                  <Badge variant={ticket.priority === 'high' ? 'destructive' : 'secondary'}>
                    {ticket.priority}
                  </Badge>
                  <Badge variant={ticket.status === 'open' ? 'default' : 'secondary'}>
                    {ticket.status}
                  </Badge>
                </div>
              </div>
              <p className="text-base text-slate-600">{ticket.description}</p>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(ticket.created_at), 'PPP')}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                </span>
              </div>
            </div>

            {/* Conversation */}
            <TicketConversationPanel ticket={ticket} isOpen={true} />
          </div>

          {/* Right column - Details panel */}
          <div className="lg:block">
            <TicketDetailsPanel
              ticket={ticket}
              isOpen={true}
              onStatusChange={handleStatusChange}
              onPriorityChange={handlePriorityChange}
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
} 