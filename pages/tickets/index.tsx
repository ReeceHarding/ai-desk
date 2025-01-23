import { EmailThreadPanel } from '@/components/email-thread-panel';
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
    Check,
    CheckCircle,
    Clock,
    EyeOff,
    Filter,
    Inbox,
    Lock,
    Mail,
    MoreHorizontal,
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
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isEmailPanelOpen, setIsEmailPanelOpen] = useState(false);

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
  }, [user, supabase, role, roleLoading]);

  const filteredTickets = tickets
    .filter(ticket => 
      (debouncedSearchQuery === '' || 
        ticket.subject.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        ticket.description.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        ticket.customer?.email?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        ticket.customer?.display_name?.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
      ) &&
      (statusFilter.length === 0 || statusFilter.includes(ticket.status)) &&
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
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-white p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <Skeleton className="h-12 w-full" />
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      </div>
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
    <div className="h-full bg-gradient-to-b from-slate-900 to-slate-950 text-white relative p-8 pt-0">
      <div className={`h-full transition-all duration-300 ${isEmailPanelOpen ? 'mr-[632px]' : ''}`}>
        {/* Main Content */}
        <div className="h-full">
          <div className="p-8 max-w-[1600px] mx-auto bg-slate-900/30 rounded-xl backdrop-blur-sm border border-slate-800/50">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <div>
                  <h1 className="text-xl font-semibold">Tickets</h1>
                  <p className="text-slate-400 text-sm">
                    Manage and track support requests
                  </p>
                </div>
                <Badge className="bg-blue-500/10 text-blue-500">
                  {filteredTickets.length} {filteredTickets.length === 1 ? 'Ticket' : 'Tickets'}
                </Badge>
              </div>
              <div className="flex items-center gap-4">
                <div className="relative w-64">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <Input
                    placeholder="Search tickets..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="pl-9"
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" className="gap-2 bg-slate-800/90 text-slate-100 hover:bg-slate-700/90 border border-slate-700 shadow-lg transition-all duration-200 px-4">
                      <Filter className="h-4 w-4" />
                      {!isEmailPanelOpen && <span>Filters</span>}
                      {(statusFilter.length > 0 || priorityFilter.length > 0) && (
                        <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium bg-indigo-500/20 text-indigo-300 rounded-full">
                          {statusFilter.length + priorityFilter.length}
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 bg-slate-800 border-slate-700 text-slate-100">
                    <div className="space-y-6 p-4">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                          <div className="h-1 w-1 rounded-full bg-slate-500"></div>
                          Status
                        </h4>
                        <div className="space-y-2.5">
                          {Object.keys(statusColors).map((status) => (
                            <label key={status} className="flex items-center gap-2.5 cursor-pointer group">
                              <div className="relative flex items-center">
                                <input
                                  type="checkbox"
                                  checked={statusFilter.includes(status)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setStatusFilter([...statusFilter, status]);
                                    } else {
                                      setStatusFilter(statusFilter.filter(s => s !== status));
                                    }
                                  }}
                                  className="peer h-4 w-4 rounded-sm border-slate-600 bg-slate-700/50 text-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:ring-offset-0 transition-all duration-200"
                                />
                              </div>
                              <div className="flex items-center gap-2 flex-1">
                                <StatusIcon status={status} className="h-3.5 w-3.5" />
                                <span className={`capitalize text-sm ${statusColors[status]} group-hover:opacity-80 transition-opacity duration-200`}>
                                  {status}
                                </span>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="border-t border-slate-700/50 pt-6">
                        <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                          <div className="h-1 w-1 rounded-full bg-slate-500"></div>
                          Priority
                        </h4>
                        <div className="space-y-2.5">
                          {Object.keys(priorityColors).map((priority) => (
                            <label key={priority} className="flex items-center gap-2.5 cursor-pointer group">
                              <div className="relative flex items-center">
                                <input
                                  type="checkbox"
                                  checked={priorityFilter.includes(priority)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setPriorityFilter([...priorityFilter, priority]);
                                    } else {
                                      setPriorityFilter(priorityFilter.filter(p => p !== priority));
                                    }
                                  }}
                                  className="peer h-4 w-4 rounded-sm border-slate-600 bg-slate-700/50 text-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:ring-offset-0 transition-all duration-200"
                                />
                              </div>
                              <div className="flex items-center gap-2 flex-1">
                                <AlertCircle className={`h-3.5 w-3.5 ${priorityColors[priority].replace('bg-', 'text-')}`} />
                                <span className={`uppercase text-sm ${priorityColors[priority]} group-hover:opacity-80 transition-opacity duration-200`}>
                                  {priority}
                                </span>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>

                      <DropdownMenuItem
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={() => {
                          const newFilter = statusFilter.includes('email') 
                            ? statusFilter.filter(s => s !== 'email')
                            : [...statusFilter, 'email'];
                          setStatusFilter(newFilter);
                        }}
                      >
                        <div className="flex items-center flex-1">
                          <Mail className="h-4 w-4 mr-2" />
                          Email Tickets
                        </div>
                        {statusFilter.includes('email') && (
                          <Check className="h-4 w-4" />
                        )}
                      </DropdownMenuItem>

                      {(statusFilter.length > 0 || priorityFilter.length > 0) && (
                        <div className="border-t border-slate-700/50 pt-4">
                          <Button
                            variant="ghost"
                            className="w-full text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all duration-200 rounded-md"
                            onClick={() => {
                              setStatusFilter([]);
                              setPriorityFilter([]);
                            }}
                          >
                            Clear all filters
                          </Button>
                        </div>
                      )}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button className="gap-2 transition-all duration-300 px-4" onClick={() => router.push('/tickets/new')}>
                  <Plus className="h-4 w-4" />
                  {!isEmailPanelOpen && <span>New Ticket</span>}
                </Button>
              </div>
            </div>

            {/* Active Filters */}
            {(statusFilter.length > 0 || priorityFilter.length > 0) && (
              <div className="flex flex-wrap gap-2 mb-8">
                {statusFilter.map((status) => (
                  <Badge
                    key={status}
                    variant="secondary"
                    className={`${statusColors[status]} cursor-pointer hover:opacity-80`}
                    onClick={() => setStatusFilter(statusFilter.filter(s => s !== status))}
                  >
                    <StatusIcon status={status} className="h-3 w-3 mr-1" />
                    {status}
                    <X className="h-3 w-3 ml-1" onClick={(e) => {
                      e.stopPropagation();
                      setStatusFilter(statusFilter.filter(s => s !== status));
                    }} />
                  </Badge>
                ))}
                {priorityFilter.map((priority) => (
                  <Badge
                    key={priority}
                    variant="secondary"
                    className={`${priorityColors[priority]} cursor-pointer hover:opacity-80`}
                    onClick={() => setPriorityFilter(priorityFilter.filter(p => p !== priority))}
                  >
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {priority.toUpperCase()}
                    <X className="h-3 w-3 ml-1" onClick={(e) => {
                      e.stopPropagation();
                      setPriorityFilter(priorityFilter.filter(p => p !== priority));
                    }} />
                  </Badge>
                ))}
                {(statusFilter.length > 0 || priorityFilter.length > 0) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-400 hover:text-white"
                    onClick={() => {
                      setStatusFilter([]);
                      setPriorityFilter([]);
                    }}
                  >
                    Clear all
                  </Button>
                )}
              </div>
            )}

            {/* No Results */}
            {filteredTickets.length === 0 && (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-800/50 mb-4">
                  <Search className="h-6 w-6 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium mb-2">No tickets found</h3>
                <p className="text-slate-400 max-w-md mx-auto">
                  {searchQuery ? 
                    `No tickets match your search "${searchQuery}". Try adjusting your search terms.` :
                    'No tickets match the selected filters. Try adjusting your filter criteria.'}
                </p>
              </div>
            )}

            {/* Tickets List */}
            <div className="space-y-6">
              {filteredTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className={`bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 hover:bg-slate-800/70 transition-all duration-300 cursor-pointer ${
                    isEmailPanelOpen ? 'pr-4' : 'pr-6'
                  }`}
                  onClick={() => handleTicketClick(ticket)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className={`transition-all duration-300 ${
                        isEmailPanelOpen ? 'h-8 w-8' : 'h-10 w-10'
                      }`}>
                        {ticket.customer?.avatar_url ? (
                          <AvatarImage src={ticket.customer.avatar_url} alt={ticket.customer.display_name || ''} />
                        ) : (
                          <AvatarFallback>
                            {ticket.customer?.display_name?.[0] || ticket.customer?.email?.[0] || '?'}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div>
                        <h3 className="font-medium text-slate-200">{ticket.subject || '(No Subject)'}</h3>
                        <p className={`text-sm text-slate-400 truncate transition-all duration-300 ${
                          isEmailPanelOpen ? 'max-w-[200px]' : 'max-w-xl'
                        }`}>{ticket.description}</p>
                      </div>
                    </div>
                    <div className={`flex items-center transition-all duration-300 ${
                      isEmailPanelOpen ? 'gap-2' : 'gap-4'
                    }`}>
                      <Badge className={statusColors[ticket.status]}>
                        <StatusIcon status={ticket.status} />
                        <span className={`ml-1 capitalize transition-all duration-300 ${
                          isEmailPanelOpen ? 'hidden' : 'inline'
                        }`}>{ticket.status}</span>
                      </Badge>
                      <Badge className={`${priorityColors[ticket.priority]} transition-all duration-300 ${
                        isEmailPanelOpen ? 'hidden sm:inline-flex' : ''
                      }`}>
                        {ticket.priority.toUpperCase()}
                      </Badge>
                      <span className={`text-sm text-slate-400 transition-all duration-300 ${
                        isEmailPanelOpen ? 'hidden lg:inline' : ''
                      }`}>
                        {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                      </span>
                      <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Email Thread Panel */}
        <EmailThreadPanel
          isOpen={isEmailPanelOpen}
          onClose={() => setIsEmailPanelOpen(false)}
          ticket={selectedTicket}
        />
      </div>
    </div>
  );
} 