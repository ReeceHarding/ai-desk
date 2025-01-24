import { EmailThreadPanel } from '@/components/email-thread-panel';
import AppLayout from '@/components/layout/AppLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserRole } from '@/hooks/useUserRole';
import { Database } from '@/types/supabase';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { formatDistanceToNow } from 'date-fns';
import debounce from 'lodash/debounce';
import {
    AlertCircle,
    CheckCircle,
    Clock,
    EyeOff,
    Filter,
    Inbox,
    Lock,
    MoreHorizontal,
    Plus,
    Search
} from 'lucide-react';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';

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
  metadata: {
    thread_id?: string;
    message_id?: string;
    email_date?: string;
  } | null;
};

const statusColors: Record<string, string> = {
  open: 'bg-blue-500/10 text-blue-500',
  pending: 'bg-yellow-500/10 text-yellow-500',
  on_hold: 'bg-orange-500/10 text-orange-500',
  solved: 'bg-green-500/10 text-green-500',
  closed: 'bg-slate-500/10 text-slate-500',
};

const priorityColors: Record<string, string> = {
  low: 'bg-blue-500/10 text-blue-500',
  medium: 'bg-yellow-500/10 text-yellow-500',
  high: 'bg-orange-500/10 text-orange-500',
  urgent: 'bg-red-500/10 text-red-500',
};

const StatusIcon = ({ status, className }: { status: string; className?: string }) => {
  const icons = {
    open: Inbox,
    pending: Clock,
    on_hold: EyeOff,
    solved: CheckCircle,
    closed: Lock,
  };
  const Icon = icons[status as keyof typeof icons] || AlertCircle;
  return <Icon className={className || "h-4 w-4"} />;
};

export default function TicketList() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isEmailPanelOpen, setIsEmailPanelOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = useSupabaseClient<Database>();
  const user = useUser();
  const router = useRouter();
  const { role, loading: roleLoading } = useUserRole();

  // Create a debounced search handler
  const debouncedSetSearch = useCallback(
    debounce((value: string) => {
      setDebouncedSearchQuery(value);
    }, 300),
    []
  );

  // Update both the immediate and debounced search values
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();
    setSearchQuery(value); // Update the input value immediately
    debouncedSetSearch(value); // Debounce the actual search
  };

  useEffect(() => {
    async function fetchTickets() {
      if (!user) return;

      const query = supabase
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
        .is('deleted_at', null);

      if (role === 'customer') {
        query.eq('customer_id', user.id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching tickets:', error);
        setError('Error fetching tickets');
        return;
      }

      if (data) {
        const typedTickets: Ticket[] = data.map(ticket => ({
          ...ticket,
          customer: ticket.customer as Profile,
          organization: ticket.organization as Organization,
        }));
        setTickets(typedTickets);
      }
      setLoading(false);
    }

    if (!roleLoading) {
      fetchTickets();
    }

    // Set up real-time subscription
    const subscription = supabase
      .channel('tickets-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
        },
        async (payload) => {
          console.log('Real-time update received:', payload);
          
          // Fetch the complete ticket data including relations
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const { data: newTicket, error } = await supabase
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
              .eq('id', payload.new.id)
              .single();

            if (!error && newTicket) {
              const typedTicket = {
                ...newTicket,
                customer: newTicket.customer as Profile,
                organization: newTicket.organization as Organization,
              };

              setTickets(currentTickets => {
                const ticketIndex = currentTickets.findIndex(t => t.id === typedTicket.id);
                if (ticketIndex >= 0) {
                  // Update existing ticket
                  const updatedTickets = [...currentTickets];
                  updatedTickets[ticketIndex] = typedTicket;
                  return updatedTickets;
                } else {
                  // Add new ticket
                  return [typedTicket, ...currentTickets];
                }
              });
            }
          } else if (payload.eventType === 'DELETE') {
            setTickets(currentTickets => 
              currentTickets.filter(ticket => ticket.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, [user, supabase, role, roleLoading]);

  const filteredTickets = tickets
    .filter(ticket => 
      (debouncedSearchQuery === '' || 
        ticket.subject.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        ticket.description.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        ticket.customer?.email?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        ticket.customer?.display_name?.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
      ) &&
      (statusFilter === null || statusFilter === ticket.status) &&
      (priorityFilter.length === 0 || priorityFilter.includes(ticket.priority))
    )
    .sort((a, b) => {
      const aValue = a[sortBy as keyof Ticket];
      const bValue = b[sortBy as keyof Ticket];
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      if (aValue instanceof Date && bValue instanceof Date) {
        return sortOrder === 'asc' 
          ? aValue.getTime() - bValue.getTime()
          : bValue.getTime() - aValue.getTime();
      }
      
      return 0;
    });

  const handleTicketClick = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setIsEmailPanelOpen(true);
  };

  if (loading || roleLoading) {
    return (
      <AppLayout>
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Tickets</h1>
                <p className="mt-1 text-sm text-gray-500">
                  Manage and respond to customer support tickets
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => router.push('/tickets/new')}
                  className="inline-flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  New Ticket
                </Button>
              </div>
            </div>

            {/* Search and filters */}
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  type="search"
                  placeholder="Search tickets..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="inline-flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      Filter
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => setStatusFilter('open')}>
                      Open Tickets
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter('closed')}>
                      Closed Tickets
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter(null)}>
                      All Tickets
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Ticket list */}
          <div className="flex-1 overflow-auto">
            {error ? (
              <div className="flex items-center justify-center p-6">
                <div className="rounded-lg bg-red-50 p-4">
                  <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Error loading tickets</h3>
                      <div className="mt-2 text-sm text-red-700">{error}</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : loading ? (
              <div className="divide-y divide-gray-200">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="p-4 sm:px-6">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="mt-2 h-4 w-32" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : tickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <Inbox className="h-12 w-12 text-gray-400" />
                <h3 className="mt-4 text-lg font-medium text-gray-900">No tickets found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Get started by creating a new ticket or waiting for customer inquiries.
                </p>
                <Button
                  onClick={() => router.push('/tickets/new')}
                  className="mt-6 inline-flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  New Ticket
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    onClick={() => handleTicketClick(ticket)}
                    className="group cursor-pointer bg-white p-4 transition-colors hover:bg-gray-50 sm:px-6"
                  >
                    <div className="flex items-start gap-4">
                      <Avatar className="h-10 w-10">
                        <AvatarImage
                          src={ticket.customer?.avatar_url || undefined}
                          alt={ticket.customer?.display_name || ''}
                        />
                        <AvatarFallback>
                          {(ticket.customer?.display_name || 'U')[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {ticket.customer?.display_name || ticket.customer?.email || 'Unknown User'}
                          </span>
                          {ticket.organization?.name && (
                            <span className="text-sm text-gray-500">
                              at {ticket.organization.name}
                            </span>
                          )}
                          <Badge
                            variant={ticket.priority === 'high' ? 'destructive' : 'secondary'}
                            className="ml-auto"
                          >
                            {ticket.priority}
                          </Badge>
                        </div>
                        <h4 className="font-medium text-gray-900">{ticket.subject}</h4>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <StatusIcon status={ticket.status} className="h-4 w-4" />
                            {ticket.status}
                          </span>
                          {ticket.created_at && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <Lock className="h-12 w-12 text-slate-400 mx-auto" />
          <h1 className="text-2xl font-semibold">Please log in to view tickets</h1>
          <Button
            onClick={() => router.push('/auth/login')}
            className="inline-flex items-center gap-2"
          >
            Log In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Tickets</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage and respond to customer support tickets
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => router.push('/tickets/new')}
                className="inline-flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                New Ticket
              </Button>
            </div>
          </div>

          {/* Search and filters */}
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                type="search"
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="inline-flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filter
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setStatusFilter('open')}>
                    Open Tickets
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter('closed')}>
                    Closed Tickets
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter(null)}>
                    All Tickets
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Ticket list */}
        <div className="flex-1 overflow-auto">
          {error ? (
            <div className="flex items-center justify-center p-6">
              <div className="rounded-lg bg-red-50 p-4">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error loading tickets</h3>
                    <div className="mt-2 text-sm text-red-700">{error}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : loading ? (
            <div className="divide-y divide-gray-200">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="p-4 sm:px-6">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="mt-2 h-4 w-32" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <Inbox className="h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">No tickets found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by creating a new ticket or waiting for customer inquiries.
              </p>
              <Button
                onClick={() => router.push('/tickets/new')}
                className="mt-6 inline-flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                New Ticket
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => handleTicketClick(ticket)}
                  className="group cursor-pointer bg-white p-4 transition-colors hover:bg-gray-50 sm:px-6"
                >
                  <div className="flex items-start gap-4">
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={ticket.customer?.avatar_url || undefined}
                        alt={ticket.customer?.display_name || ''}
                      />
                      <AvatarFallback>
                        {(ticket.customer?.display_name || 'U')[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {ticket.customer?.display_name || ticket.customer?.email || 'Unknown User'}
                        </span>
                        {ticket.organization?.name && (
                          <span className="text-sm text-gray-500">
                            at {ticket.organization.name}
                          </span>
                        )}
                        <Badge
                          variant={ticket.priority === 'high' ? 'destructive' : 'secondary'}
                          className="ml-auto"
                        >
                          {ticket.priority}
                        </Badge>
                      </div>
                      <h4 className="font-medium text-gray-900">{ticket.subject}</h4>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <StatusIcon status={ticket.status} className="h-4 w-4" />
                          {ticket.status}
                        </span>
                        {ticket.created_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Email Thread Panel */}
      <EmailThreadPanel
        isOpen={isEmailPanelOpen}
        onClose={() => {
          setIsEmailPanelOpen(false);
          setSelectedTicket(null);
        }}
        ticket={selectedTicket ? {
          id: selectedTicket.id,
          thread_id: selectedTicket.metadata?.thread_id,
          message_id: selectedTicket.metadata?.message_id,
        } : null}
      />
    </AppLayout>
  );
} 