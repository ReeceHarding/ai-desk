import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { Database } from '@/types/supabase';
import { useUserRole } from '@/hooks/useUserRole';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Search,
  Filter,
  MoreHorizontal,
  Clock,
  EyeOff,
  CheckCircle,
  Lock,
  Inbox,
  AlertCircle,
  ChevronDown,
  Plus,
  X,
} from 'lucide-react';
import debounce from 'lodash/debounce';

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
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-white">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-semibold mb-1">Tickets</h1>
              <p className="text-slate-400">Manage and track support requests</p>
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
                <Button variant="secondary" className="gap-2 bg-white text-slate-900 hover:bg-white/90">
                  <Filter className="h-4 w-4" />
                  Filters
                  {(statusFilter.length > 0 || priorityFilter.length > 0) && (
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium">
                        {statusFilter.length + priorityFilter.length}
                      </span>
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  )}
                  {(statusFilter.length === 0 && priorityFilter.length === 0) && (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-72 bg-slate-800/95 backdrop-blur-sm border border-slate-700 p-4 shadow-xl">
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-medium text-slate-300 mb-3">Status</h4>
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
                              className="peer h-4 w-4 rounded border-slate-600 bg-slate-700/50 text-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:ring-offset-0"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusIcon status={status} className="h-3.5 w-3.5" />
                            <span className={`capitalize text-sm ${statusColors[status]} group-hover:opacity-80`}>
                              {status}
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-slate-700/50 pt-6">
                    <h4 className="text-sm font-medium text-slate-300 mb-3">Priority</h4>
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
                              className="peer h-4 w-4 rounded border-slate-600 bg-slate-700/50 text-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:ring-offset-0"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-3.5 w-3.5" />
                            <span className={`uppercase text-sm ${priorityColors[priority]} group-hover:opacity-80`}>
                              {priority}
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {(statusFilter.length > 0 || priorityFilter.length > 0) && (
                    <div className="border-t border-slate-700/50 pt-4">
                      <Button
                        variant="ghost"
                        className="w-full text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
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
            <Button className="gap-2" onClick={() => router.push('/tickets/new')}>
              <Plus className="h-4 w-4" />
              New Ticket
            </Button>
          </div>
        </div>

        {/* Active Filters */}
        {(statusFilter.length > 0 || priorityFilter.length > 0) && (
          <div className="flex flex-wrap gap-2 mb-4">
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

        {/* Tickets Table */}
        {filteredTickets.length > 0 && (
          <div className="space-y-4">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg overflow-hidden">
              <table className="w-full text-sm text-slate-300">
                <thead className="bg-slate-900/50 backdrop-blur-sm">
                  <tr className="border-b border-slate-800">
                    <th className="text-left py-3 px-4 font-medium">Subject</th>
                    <th className="text-left py-3 px-4 font-medium">Customer</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-left py-3 px-4 font-medium">Priority</th>
                    <th className="text-left py-3 px-4 font-medium">Created</th>
                    <th className="text-left py-3 px-4 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((ticket) => (
                    <motion.tr
                      key={ticket.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/tickets/${ticket.id}`)}
                    >
                      <td className="py-3 px-4">
                        <div className="font-medium text-white">{ticket.subject}</div>
                        <div className="text-slate-400 truncate max-w-md">{ticket.description}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <img
                              src={ticket.customer?.avatar_url || undefined}
                              alt={ticket.customer?.display_name || 'Customer'}
                            />
                          </Avatar>
                          <div>
                            <div className="font-medium">
                              {ticket.customer?.display_name || 'Unknown Customer'}
                            </div>
                            <div className="text-slate-400">{ticket.customer?.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={statusColors[ticket.status]}>
                          <StatusIcon status={ticket.status} />
                          <span className="ml-1 capitalize">{ticket.status}</span>
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={priorityColors[ticket.priority]}>
                          {ticket.priority.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                      </td>
                      <td className="py-3 px-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-slate-400 hover:text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Add ticket actions here
                          }}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 