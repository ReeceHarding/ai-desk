import { EmailThreadPanel } from '@/components/email-thread-panel';
import AppLayout from '@/components/layout/AppLayout';
import { TicketCard } from '@/components/tickets/TicketCard';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserRole } from '@/hooks/useUserRole';
import { Database } from '@/types/supabase';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import debounce from 'lodash/debounce';
import {
    AlertCircle,
    CheckCircle,
    Clock,
    EyeOff,
    Filter,
    Inbox,
    Lock,
    Plus,
    Search,
    X
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
  ticket_email_chats: Array<{
    from_address: string | null;
    subject: string | null;
  }> | null;
  last_response_at?: string | null;
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

// Add a helper function to parse email address
const parseEmailAddress = (emailStr: string | null) => {
  if (!emailStr) return { name: null, email: null };
  
  // Match pattern: "Name <email@domain.com>" or just "email@domain.com"
  const match = emailStr.match(/^(?:([^<]*?)\s*<)?([^>]+)>?$/);
  if (!match) return { name: null, email: emailStr };
  
  const [, name, email] = match;
  return {
    name: name ? name.trim() : null,
    email: email.trim()
  };
};

export default function TicketList() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isEmailPanelOpen, setIsEmailPanelOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStaff, setIsStaff] = useState(false);

  const supabase = useSupabaseClient<Database>();
  const user = useUser();
  const router = useRouter();
  const { role, loading: roleLoading } = useUserRole();

  const TICKETS_PER_PAGE = 10;
  const loadMoreRef = useCallback((node: HTMLDivElement) => {
    if (loading) return;
    
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        loadMoreTickets();
      }
    });

    if (node) observer.observe(node);
  }, [loading, hasMore, loadingMore]);

  const loadMoreTickets = async () => {
    if (!user || loadingMore || !hasMore) return;

    setLoadingMore(true);
    const nextPage = page + 1;
    const from = nextPage * TICKETS_PER_PAGE;
    const to = from + TICKETS_PER_PAGE - 1;

    try {
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
          ),
          ticket_email_chats!ticket_email_chats_ticket_id_fkey (
            from_address,
            subject
          )
        `)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (role === 'customer') {
        query.eq('customer_id', user.id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching more tickets:', error);
        return;
      }

      if (data) {
        const typedTickets: Ticket[] = data.map(ticket => ({
          ...ticket,
          customer: ticket.customer as Profile,
          organization: ticket.organization as Organization,
          ticket_email_chats: Array.isArray(ticket.ticket_email_chats) ? ticket.ticket_email_chats : null
        }));

        setTickets(prev => [...prev, ...typedTickets]);
        setPage(nextPage);
        setHasMore(data.length === TICKETS_PER_PAGE);
      }
    } finally {
      setLoadingMore(false);
    }
  };

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

      setLoading(true);
      setPage(0);
      setHasMore(true);

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
          ),
          ticket_email_chats!ticket_email_chats_ticket_id_fkey (
            from_address,
            subject
          )
        `)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(0, TICKETS_PER_PAGE - 1);

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
          ticket_email_chats: Array.isArray(ticket.ticket_email_chats) ? ticket.ticket_email_chats : null
        }));
        setTickets(typedTickets);
        setHasMore(data.length === TICKETS_PER_PAGE);
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
                ),
                ticket_email_chats!ticket_email_chats_ticket_id_fkey (
                  from_address,
                  subject
                )
              `)
              .eq('id', payload.new.id)
              .single();

            if (!error && newTicket) {
              const typedTicket = {
                ...newTicket,
                customer: newTicket.customer as Profile,
                organization: newTicket.organization as Organization,
                ticket_email_chats: Array.isArray(newTicket.ticket_email_chats) ? newTicket.ticket_email_chats : null
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

  // Filter tickets
  const filteredTickets = tickets.filter(ticket => {
    // Search filter
    if (debouncedSearchQuery) {
      const searchLower = debouncedSearchQuery.toLowerCase();
      const matchesSearch = 
        // Search in ticket fields
        ticket.subject?.toLowerCase().includes(searchLower) ||
        ticket.description?.toLowerCase().includes(searchLower) ||
        ticket.id.toString().includes(searchLower) ||
        ticket.status.toLowerCase().includes(searchLower) ||
        ticket.priority?.toLowerCase().includes(searchLower) ||
        // Search in customer fields
        ticket.customer?.display_name?.toLowerCase().includes(searchLower) ||
        ticket.customer?.email?.toLowerCase().includes(searchLower) ||
        // Search in organization
        ticket.organization?.name?.toLowerCase().includes(searchLower) ||
        // Search in email fields
        ticket.ticket_email_chats?.[0]?.subject?.toLowerCase().includes(searchLower) ||
        ticket.ticket_email_chats?.[0]?.from_address?.toLowerCase().includes(searchLower);

      if (!matchesSearch) return false;
    }

    // Status filter
    if (statusFilter && ticket.status !== statusFilter) {
      return false;
    }

    // Priority filter
    if (priorityFilter.length > 0 && !priorityFilter.includes(ticket.priority || '')) {
      return false;
    }

    return true;
  });

  // Sort tickets
  const sortedTickets = [...filteredTickets].sort((a, b) => {
    const aValue = a[sortBy as keyof Ticket];
    const bValue = b[sortBy as keyof Ticket];

    if (!aValue || !bValue) return 0;

    const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    return sortOrder === 'asc' ? comparison : -comparison;
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
          <div className="px-4 py-3 border-b bg-white sticky top-0 z-10 space-y-3">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold text-gray-900">Tickets</h1>
              <Button
                onClick={() => router.push('/tickets/new')}
                size="sm"
                className="hidden sm:flex"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Ticket
              </Button>
              <Button
                onClick={() => router.push('/tickets/new')}
                size="icon"
                className="sm:hidden"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Search and Filters */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  type="search"
                  placeholder="Search tickets..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="w-full pl-9 pr-4"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setDebouncedSearchQuery('');
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="h-4 w-4 text-gray-500" />
                  </button>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Filter className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setStatusFilter('open')}>
                    Open Tickets
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter('pending')}>
                    Pending Tickets
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter(null)}>
                    All Tickets
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Tickets List */}
          <div className="flex-1 overflow-auto">
            {error ? (
              <div className="p-4 text-center text-red-600">
                {error}
              </div>
            ) : loading ? (
              <div className="divide-y">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="p-4">
                    <Skeleton className="h-4 w-1/4 mb-2" />
                    <Skeleton className="h-4 w-3/4 mb-4" />
                    <div className="flex items-center space-x-3">
                      <Skeleton className="h-6 w-6 rounded-full" />
                      <Skeleton className="h-4 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : tickets.length === 0 ? (
              <div className="p-8 text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-1">No tickets found</h3>
                <p className="text-gray-500">Create a new ticket to get started</p>
              </div>
            ) : (
              <div className="divide-y">
                {tickets.map((ticket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    onClick={() => {
                      setSelectedTicket(ticket);
                      setIsEmailPanelOpen(true);
                    }}
                  />
                ))}
                {loadingMore && (
                  <div className="p-4">
                    <Skeleton className="h-4 w-1/4 mb-2" />
                    <Skeleton className="h-4 w-3/4 mb-4" />
                    <div className="flex items-center space-x-3">
                      <Skeleton className="h-6 w-6 rounded-full" />
                      <Skeleton className="h-4 w-1/3" />
                    </div>
                  </div>
                )}
                <div ref={loadMoreRef} style={{ height: '1px' }} />
              </div>
            )}
          </div>
        </div>

        {/* Email Thread Panel */}
        {selectedTicket && (
          <EmailThreadPanel
            isOpen={isEmailPanelOpen}
            onClose={() => {
              setIsEmailPanelOpen(false);
              setSelectedTicket(null);
            }}
            ticket={selectedTicket}
          />
        )}
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
            onClick={() => router.push('/auth/signin')}
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
        <div className="px-4 py-3 border-b bg-white sticky top-0 z-10 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-900">Tickets</h1>
            <Button
              onClick={() => router.push('/tickets/new')}
              size="sm"
              className="hidden sm:flex"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Ticket
            </Button>
            <Button
              onClick={() => router.push('/tickets/new')}
              size="icon"
              className="sm:hidden"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Search and Filters */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                type="search"
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full pl-9 pr-4"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setDebouncedSearchQuery('');
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <Filter className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setStatusFilter('open')}>
                  Open Tickets
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('pending')}>
                  Pending Tickets
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter(null)}>
                  All Tickets
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Tickets List */}
        <div className="flex-1 overflow-auto">
          {error ? (
            <div className="p-4 text-center text-red-600">
              {error}
            </div>
          ) : loading ? (
            <div className="divide-y">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="p-4">
                  <Skeleton className="h-4 w-1/4 mb-2" />
                  <Skeleton className="h-4 w-3/4 mb-4" />
                  <div className="flex items-center space-x-3">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <div className="p-8 text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-1">No tickets found</h3>
              <p className="text-gray-500">Create a new ticket to get started</p>
            </div>
          ) : (
            <div className="divide-y">
              {tickets.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  onClick={() => {
                    setSelectedTicket(ticket);
                    setIsEmailPanelOpen(true);
                  }}
                />
              ))}
              {loadingMore && (
                <div className="p-4">
                  <Skeleton className="h-4 w-1/4 mb-2" />
                  <Skeleton className="h-4 w-3/4 mb-4" />
                  <div className="flex items-center space-x-3">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                </div>
              )}
              <div ref={loadMoreRef} style={{ height: '1px' }} />
            </div>
          )}
        </div>
      </div>

      {/* Email Thread Panel */}
      {selectedTicket && (
        <EmailThreadPanel
          isOpen={isEmailPanelOpen}
          onClose={() => {
            setIsEmailPanelOpen(false);
            setSelectedTicket(null);
          }}
          ticket={selectedTicket}
        />
      )}
    </AppLayout>
  );
} 