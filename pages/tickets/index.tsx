import { EmailThreadPanel } from '@/components/email-thread-panel';
import { AppLayout } from '@/components/layout/AppLayout';
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
  from_name: string | null;
  subject: string | null;
  gmail_date: string | null;
  created_at: string;
};

type Comment = {
  id: string;
  body: string | null;
  created_at: string;
  author: Profile | null;
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
  comments: Comment[];
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

  const fetchTickets = async () => {
    try {
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user?.id)
        .single();

      if (profileError) {
        console.error('Error fetching user profile:', profileError);
        setError('Failed to fetch user profile');
        return;
      }

      const { data: ticketsData, error: ticketsError } = await supabase
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
          emailChats:ticket_email_chats!ticket_email_chats_ticket_id_fkey (
            body,
            from_address,
            from_name,
            subject,
            gmail_date
          ),
          comments:comments!comments_ticket_id_fkey (
            id,
            body,
            created_at,
            author:profiles!comments_author_id_fkey (
              display_name,
              email,
              avatar_url
            )
          )
        `)
        .eq('org_id', userProfile.org_id)
        .order('created_at', { ascending: false });

      if (ticketsError) throw ticketsError;

      const typedTickets = ticketsData?.map(ticket => ({
        ...ticket,
        customer: ticket.customer as Profile,
        organization: ticket.organization as Organization,
        emailChats: ticket.emailChats || [],
        comments: ticket.comments || []
      })) || [];

      setTickets(typedTickets);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      setError('Failed to fetch tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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
                emailChats:ticket_email_chats!ticket_email_chats_ticket_id_fkey (
                  body,
                  from_address,
                  subject
                ),
                comments:comments!comments_ticket_id_fkey (
                  id,
                  body,
                  created_at,
                  author:profiles!comments_author_id_fkey (
                    display_name,
                    email,
                    avatar_url
                  )
                )
              `)
              .eq('id', payload.new.id)
              .single();

            if (!error && newTicket) {
              const typedTicket = {
                ...newTicket,
                customer: newTicket.customer as Profile,
                organization: newTicket.organization as Organization,
                emailChats: newTicket.emailChats || [],
                comments: newTicket.comments || []
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
                    // Get the latest message (either email, comment, or ticket description)
                    const latestEmail = ticket.emailChats?.[0];
                    const latestComment = ticket.comments?.[0];
                    
                    // Add logging
                    console.log('Ticket data:', {
                      ticketId: ticket.id,
                      latestEmail: {
                        exists: !!latestEmail,
                        from_name: latestEmail?.from_name,
                        from_address: latestEmail?.from_address,
                        body: latestEmail?.body?.substring(0, 100), // First 100 chars
                        date: latestEmail?.gmail_date
                      },
                      latestComment: {
                        exists: !!latestComment,
                        author: latestComment?.author,
                        date: latestComment?.created_at
                      },
                      customer: {
                        display_name: ticket.customer?.display_name,
                        email: ticket.customer?.email
                      }
                    });

                    // Compare timestamps to get the most recent message
                    const emailDate = latestEmail?.gmail_date ? new Date(latestEmail.gmail_date) : new Date(0);
                    const commentDate = latestComment?.created_at ? new Date(latestComment.created_at) : new Date(0);
                    const ticketDate = new Date(ticket.created_at);
                    
                    // Determine which message is most recent
                    const isEmailMoreRecent = emailDate > commentDate && emailDate > ticketDate;
                    const isCommentMoreRecent = commentDate > emailDate && commentDate > ticketDate;
                    
                    // Use the most recent message content
                    let messageContent;
                    let senderInfo = '';
                    let messageDate;
                    let avatarUrl;
                    
                    if (isEmailMoreRecent) {
                      messageContent = latestEmail?.body;
                      // For email messages, use the sender's name or email
                      senderInfo = latestEmail?.from_name?.trim() || 
                        latestEmail?.from_address?.split('@')[0] || 
                        'Unknown Sender';
                      messageDate = emailDate;
                      avatarUrl = undefined;
                    } else if (isCommentMoreRecent) {
                      messageContent = latestComment?.body;
                      // For comments, use the author's display name
                      senderInfo = latestComment?.author?.display_name || latestComment?.author?.email || '';
                      messageDate = commentDate;
                      avatarUrl = latestComment?.author?.avatar_url;
                    } else {
                      messageContent = ticket.description;
                      // For ticket descriptions, use the CUSTOMER name instead of organization
                      senderInfo = ticket.customer?.display_name 
                        || ticket.customer?.email 
                        || 'Unknown Customer';
                      messageDate = ticketDate;
                      avatarUrl = ticket.customer?.avatar_url;
                    }
                    
                    const messagePreview = messageContent ? getEmailPreview(messageContent) : '';

                    return (
                      <div
                        key={ticket.id}
                        onClick={() => handleTicketClick(ticket)}
                        className="p-3 hover:bg-slate-50 active:bg-slate-100"
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage
                              src={avatarUrl || undefined}
                              alt={senderInfo}
                            />
                            <AvatarFallback>
                              {(senderInfo || 'U')[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-[15px] text-slate-900 truncate">
                                {senderInfo}
                              </span>
                              <span className="shrink-0 text-xs text-slate-500">
                                {formatDistanceToNow(messageDate, { addSuffix: true })}
                              </span>
                            </div>
                            <h4 className="text-[15px] text-slate-900 truncate">{ticket.subject}</h4>
                            <p className="text-sm text-slate-500 truncate">
                              {messagePreview || 'No preview available'}
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
            org_id: selectedTicket.org_id,
            thread_id: selectedTicket.metadata?.thread_id,
            message_id: selectedTicket.metadata?.message_id,
            subject: selectedTicket.subject
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
            onClick={() => router.push('/auth/signin')}
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
                  // Get the latest message (either email, comment, or ticket description)
                  const latestEmail = ticket.emailChats?.[0];
                  const latestComment = ticket.comments?.[0];
                  
                  // Add logging
                  console.log('Ticket data:', {
                    ticketId: ticket.id,
                    latestEmail: {
                      exists: !!latestEmail,
                      from_name: latestEmail?.from_name,
                      from_address: latestEmail?.from_address,
                      body: latestEmail?.body?.substring(0, 100), // First 100 chars
                      date: latestEmail?.gmail_date
                    },
                    latestComment: {
                      exists: !!latestComment,
                      author: latestComment?.author,
                      date: latestComment?.created_at
                    },
                    customer: {
                      display_name: ticket.customer?.display_name,
                      email: ticket.customer?.email
                    }
                  });

                  // Compare timestamps to get the most recent message
                  const emailDate = latestEmail?.gmail_date ? new Date(latestEmail.gmail_date) : new Date(0);
                  const commentDate = latestComment?.created_at ? new Date(latestComment.created_at) : new Date(0);
                  const ticketDate = new Date(ticket.created_at);
                  
                  // Determine which message is most recent
                  const isEmailMoreRecent = emailDate > commentDate && emailDate > ticketDate;
                  const isCommentMoreRecent = commentDate > emailDate && commentDate > ticketDate;
                  
                  // Use the most recent message content
                  let messageContent;
                  let senderInfo = '';
                  let messageDate;
                  let avatarUrl;
                  
                  if (isEmailMoreRecent) {
                    messageContent = latestEmail?.body;
                    // For email messages, use the sender's name or email
                    senderInfo = latestEmail?.from_name?.trim() || 
                      latestEmail?.from_address?.split('@')[0] || 
                      'Unknown Sender';
                    messageDate = emailDate;
                    avatarUrl = undefined;
                  } else if (isCommentMoreRecent) {
                    messageContent = latestComment?.body;
                    // For comments, use the author's display name
                    senderInfo = latestComment?.author?.display_name || latestComment?.author?.email || '';
                    messageDate = commentDate;
                    avatarUrl = latestComment?.author?.avatar_url;
                  } else {
                    messageContent = ticket.description;
                    // For ticket descriptions, use the CUSTOMER name instead of organization
                    senderInfo = ticket.customer?.display_name 
                      || ticket.customer?.email 
                      || 'Unknown Customer';
                    messageDate = ticketDate;
                    avatarUrl = ticket.customer?.avatar_url;
                  }
                  
                  const messagePreview = messageContent ? getEmailPreview(messageContent) : '';

                  return (
                    <div
                      key={ticket.id}
                      onClick={() => handleTicketClick(ticket)}
                      className="p-3 hover:bg-slate-50 active:bg-slate-100"
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage
                            src={avatarUrl || undefined}
                            alt={senderInfo}
                          />
                          <AvatarFallback>
                            {(senderInfo || 'U')[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-[15px] text-slate-900 truncate">
                              {senderInfo}
                            </span>
                            <span className="shrink-0 text-xs text-slate-500">
                              {formatDistanceToNow(messageDate, { addSuffix: true })}
                            </span>
                          </div>
                          <h4 className="text-[15px] text-slate-900 truncate">{ticket.subject}</h4>
                          <p className="text-sm text-slate-500 truncate">
                            {messagePreview || 'No preview available'}
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
          org_id: selectedTicket.org_id,
          thread_id: selectedTicket.metadata?.thread_id,
          message_id: selectedTicket.metadata?.message_id,
          subject: selectedTicket.subject
        } : null}
      />
    </AppLayout>
  );
} 