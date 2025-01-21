import { useEffect, useState } from 'react';
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
} from 'lucide-react';

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

const StatusIcon = ({ status }: { status: string }) => {
  const icons = {
    open: Inbox,
    pending: Clock,
    on_hold: EyeOff,
    solved: CheckCircle,
    closed: Lock,
  };
  const Icon = icons[status as keyof typeof icons] || AlertCircle;
  return <Icon className="h-4 w-4" />;
};

export default function TicketList() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const supabase = useSupabaseClient<Database>();
  const user = useUser();
  const router = useRouter();
  const { role, loading: roleLoading } = useUserRole();

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
      (searchQuery === '' || 
        ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.customer?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.customer?.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
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
              {tickets.length} Total
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
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>Status</DropdownMenuItem>
                <DropdownMenuItem>Priority</DropdownMenuItem>
                <DropdownMenuItem>Date</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Ticket
            </Button>
          </div>
        </div>

        {/* Tickets Table */}
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
    </div>
  );
} 