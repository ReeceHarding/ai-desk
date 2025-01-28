import { EmailThreadPanel } from '@/components/email-thread-panel';
import AppLayout from '@/components/layout/AppLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserRole } from '@/hooks/useUserRole';
import { Database } from '@/types/supabase';
import { getEmailPreview, parseEmailBody } from '@/utils/email-parser';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { formatDistanceToNow } from 'date-fns';
import debounce from 'lodash/debounce';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  EyeOff,
  Inbox,
  Lock,
  Menu,
  Plus
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

type EmailChat = {
  id: string;
  body: string | null;
  from_address: string | null;
  subject: string | null;
  created_at: string;
};

type Ticket = Database['public']['Tables']['tickets']['Row'] & {
  customer: Profile | null;
  organization: Organization | null;
  metadata: {
    thread_id?: string;
    message_id?: string;
    email_date?: string;
    [key: string]: any;
  };
  emailChats: EmailChat[];
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
  const { role, loading: roleLoading, isUserLoading } = useUserRole();

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
          ),
          ticket_email_chats!ticket_email_chats_ticket_id_fkey (
            body,
            from_address,
            subject
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
          emailChats: ticket.ticket_email_chats || []
        }));
        setTickets(typedTickets);
      }
      setLoading(false);
    }

    if (!roleLoading && !isUserLoading) {
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
                  body,
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
                emailChats: newTicket.ticket_email_chats || []
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
  }, [user, supabase, role, roleLoading, isUserLoading]);

  const filteredTickets = tickets
    .filter(ticket => {
      if (debouncedSearchQuery === '') return true;
      
      const searchLower = debouncedSearchQuery.toLowerCase();
      
      // Search in ticket fields
      if (
        ticket.subject?.toLowerCase().includes(searchLower) ||
        ticket.description?.toLowerCase().includes(searchLower) ||
        ticket.customer?.display_name?.toLowerCase().includes(searchLower) ||
        ticket.customer?.email?.toLowerCase().includes(searchLower)
      ) {
        return true;
      }

      // Search in email chats
      if (ticket.emailChats?.some(email => 
        parseEmailBody(email.body).toLowerCase().includes(searchLower) ||
        email.from_address?.toLowerCase().includes(searchLower) ||
        email.subject?.toLowerCase().includes(searchLower)
      )) {
        return true;
      }
      
      return false;
    })
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

  if (loading || roleLoading || isUserLoading) {
    return (
      <AppLayout>
        <div className="h-full flex flex-col bg-white">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-slate-200/50">
            <div className="flex items-center gap-3 p-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-12 w-12 rounded-full"
              >
                <Menu className="h-6 w-6" />
              </Button>
              
              <div className="flex-1">
                <Input
                  type="search"
                  placeholder="Search tickets..."
                  className="h-12 pl-10 rounded-full bg-slate-100/80"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  aria-label="Search tickets"
                />
              </div>

              <Avatar className="h-10 w-10">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback>
                  {user?.email?.[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>

          {/* Primary sections */}
          <div className="flex-1 overflow-auto">
            <div className="divide-y divide-slate-200/50">
              {/* Primary sections */}
              <div className="p-3 flex items-center justify-between hover:bg-slate-50">
                <div className="flex items-center gap-4">
                  <Inbox className="h-5 w-5 text-blue-500" />
                  <span className="font-medium">All tickets</span>
                </div>
                <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                  {tickets.length}
                </Badge>
              </div>
              <div className="p-3 flex items-center justify-between hover:bg-slate-50">
                <div className="flex items-center gap-4">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <span className="font-medium">High priority</span>
                </div>
                <Badge variant="secondary" className="bg-red-100 text-red-700">
                  {tickets.filter(t => t.priority === 'high').length}
                </Badge>
              </div>
              <div className="p-3 flex items-center justify-between hover:bg-slate-50">
                <div className="flex items-center gap-4">
                  <Clock className="h-5 w-5 text-orange-500" />
                  <span className="font-medium">Pending</span>
                </div>
                <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                  {tickets.filter(t => t.status === 'open').length}
                </Badge>
              </div>
            </div>

            {/* Ticket list */}
            <div className="mt-2 divide-y divide-slate-200/50">
              {error ? (
                <div className="p-4">
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
                <div>
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="p-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-36" />
                          <Skeleton className="mt-2 h-4 w-24" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="rounded-full bg-slate-100 p-3 mx-auto w-fit">
                    <Inbox className="h-6 w-6 text-slate-400" />
                  </div>
                  <h3 className="mt-4 text-base font-medium text-slate-900">No tickets found</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Get started by creating a new ticket or waiting for customer inquiries.
                  </p>
                  <Button
                    onClick={() => router.push('/tickets/new')}
                    className="mt-6 min-h-[44px]"
                  >
                    <Plus className="h-5 w-5" />
                    New Ticket
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-slate-200/50">
                  {filteredTickets.map((ticket) => {
                    // Check both emailChats and description for email content
                    const emailContent = ticket.emailChats?.[0]?.body || ticket.description;
                    const emailPreview = emailContent ? getEmailPreview(emailContent) : '';

                    // Extract sender information from subject or description
                    let senderInfo = '';
                    if (ticket.subject?.includes('sent you')) {
                      senderInfo = ticket.subject.split(' sent you')[0];
                    } else if (ticket.subject?.includes('from')) {
                      senderInfo = ticket.subject.split(' from ')[1]?.split(' ')[0];
                    } else if (ticket.subject?.includes('@')) {
                      senderInfo = ticket.subject.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] || '';
                    } else if (emailContent?.includes('@')) {
                      senderInfo = emailContent.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] || '';
                    }

                    console.log('Processing ticket:', {
                      id: ticket.id,
                      subject: ticket.subject,
                      hasEmailChats: !!ticket.emailChats?.length,
                      hasDescription: !!ticket.description,
                      emailContentSource: ticket.emailChats?.[0]?.body ? 'emailChats' : ticket.description ? 'description' : 'none',
                      emailContentPreview: emailContent?.substring(0, 100),
                      parsedPreview: emailPreview,
                      extractedSender: senderInfo
                    });

                    return (
                      <div
                        key={ticket.id}
                        onClick={() => handleTicketClick(ticket)}
                        className="p-3 hover:bg-slate-50 active:bg-slate-100"
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage
                              src={ticket.customer?.avatar_url || undefined}
                              alt={ticket.customer?.display_name || ''}
                            />
                            <AvatarFallback>
                              {(senderInfo || 'U')[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-[15px] text-slate-900 truncate">
                                {senderInfo || ticket.emailChats?.[0]?.from_address || 'Unknown Sender'}
                              </span>
                              <span className="shrink-0 text-xs text-slate-500">
                                {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                              </span>
                            </div>
                            <h4 className="text-[15px] text-slate-900 truncate">{ticket.subject}</h4>
                            <p className="text-sm text-slate-500 truncate">
                              {emailPreview || 'No preview available'}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Floating action button */}
          <Button
            onClick={() => router.push('/tickets/new')}
            className="fixed right-4 bottom-4 h-14 w-14 rounded-full shadow-lg"
          >
            <Plus className="h-6 w-6" />
          </Button>
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

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 text-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="rounded-full bg-slate-100 p-4 mx-auto w-fit">
            <Lock className="h-12 w-12 text-slate-400" />
          </div>
          <h1 className="text-2xl font-semibold">Please log in to view tickets</h1>
          <Button
            onClick={() => router.push('/auth/login')}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-sm shadow-blue-500/10 hover:shadow-md hover:shadow-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
          >
            Log In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="h-full flex flex-col bg-white">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-slate-200/50">
          <div className="flex items-center gap-3 p-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 rounded-full"
            >
              <Menu className="h-6 w-6" />
            </Button>
            
            <div className="flex-1">
              <Input
                type="search"
                placeholder="Search tickets..."
                className="h-12 pl-10 rounded-full bg-slate-100/80"
                value={searchQuery}
                onChange={handleSearchChange}
                aria-label="Search tickets"
              />
            </div>

            <Avatar className="h-10 w-10">
              <AvatarImage src={user?.user_metadata?.avatar_url} />
              <AvatarFallback>
                {user?.email?.[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>

        {/* Primary sections */}
        <div className="flex-1 overflow-auto">
          <div className="divide-y divide-slate-200/50">
            {/* Primary sections */}
            <div className="p-3 flex items-center justify-between hover:bg-slate-50">
              <div className="flex items-center gap-4">
                <Inbox className="h-5 w-5 text-blue-500" />
                <span className="font-medium">All tickets</span>
              </div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                {tickets.length}
              </Badge>
            </div>
            <div className="p-3 flex items-center justify-between hover:bg-slate-50">
              <div className="flex items-center gap-4">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <span className="font-medium">High priority</span>
              </div>
              <Badge variant="secondary" className="bg-red-100 text-red-700">
                {tickets.filter(t => t.priority === 'high').length}
              </Badge>
            </div>
            <div className="p-3 flex items-center justify-between hover:bg-slate-50">
              <div className="flex items-center gap-4">
                <Clock className="h-5 w-5 text-orange-500" />
                <span className="font-medium">Pending</span>
              </div>
              <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                {tickets.filter(t => t.status === 'open').length}
              </Badge>
            </div>
          </div>

          {/* Ticket list */}
          <div className="mt-2 divide-y divide-slate-200/50">
            {error ? (
              <div className="p-4">
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
              <div>
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="p-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-36" />
                        <Skeleton className="mt-2 h-4 w-24" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="p-8 text-center">
                <div className="rounded-full bg-slate-100 p-3 mx-auto w-fit">
                  <Inbox className="h-6 w-6 text-slate-400" />
                </div>
                <h3 className="mt-4 text-base font-medium text-slate-900">No tickets found</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Get started by creating a new ticket or waiting for customer inquiries.
                </p>
                <Button
                  onClick={() => router.push('/tickets/new')}
                  className="mt-6 min-h-[44px]"
                >
                  <Plus className="h-5 w-5" />
                  New Ticket
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-slate-200/50">
                {filteredTickets.map((ticket) => {
                  // Check both emailChats and description for email content
                  const emailContent = ticket.emailChats?.[0]?.body || ticket.description;
                  const emailPreview = emailContent ? getEmailPreview(emailContent) : '';

                  // Extract sender information from subject or description
                  let senderInfo = '';
                  if (ticket.subject?.includes('sent you')) {
                    senderInfo = ticket.subject.split(' sent you')[0];
                  } else if (ticket.subject?.includes('from')) {
                    senderInfo = ticket.subject.split(' from ')[1]?.split(' ')[0];
                  } else if (ticket.subject?.includes('@')) {
                    senderInfo = ticket.subject.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] || '';
                  } else if (emailContent?.includes('@')) {
                    senderInfo = emailContent.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] || '';
                  }

                  console.log('Processing ticket:', {
                    id: ticket.id,
                    subject: ticket.subject,
                    hasEmailChats: !!ticket.emailChats?.length,
                    hasDescription: !!ticket.description,
                    emailContentSource: ticket.emailChats?.[0]?.body ? 'emailChats' : ticket.description ? 'description' : 'none',
                    emailContentPreview: emailContent?.substring(0, 100),
                    parsedPreview: emailPreview,
                    extractedSender: senderInfo
                  });

                  return (
                    <div
                      key={ticket.id}
                      onClick={() => handleTicketClick(ticket)}
                      className="p-3 hover:bg-slate-50 active:bg-slate-100"
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage
                            src={ticket.customer?.avatar_url || undefined}
                            alt={ticket.customer?.display_name || ''}
                          />
                          <AvatarFallback>
                            {(senderInfo || 'U')[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-[15px] text-slate-900 truncate">
                              {senderInfo || ticket.emailChats?.[0]?.from_address || 'Unknown Sender'}
                            </span>
                            <span className="shrink-0 text-xs text-slate-500">
                              {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          <h4 className="text-[15px] text-slate-900 truncate">{ticket.subject}</h4>
                          <p className="text-sm text-slate-500 truncate">
                            {emailPreview || 'No preview available'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Floating action button */}
        <Button
          onClick={() => router.push('/tickets/new')}
          className="fixed right-4 bottom-4 h-14 w-14 rounded-full shadow-lg"
        >
          <Plus className="h-6 w-6" />
        </Button>
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