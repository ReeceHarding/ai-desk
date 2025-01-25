import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Database } from '@/types/supabase';
import { motion } from 'framer-motion';
import {
    AlertCircle,
    Building,
    CheckCircle,
    Clock,
    EyeOff,
    Inbox,
    Lock,
} from 'lucide-react';
import Image from 'next/image';

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

interface TicketDetailsPanelProps {
  ticket: Ticket;
  isOpen: boolean;
  onStatusChange: (status: Ticket['status']) => void;
  onPriorityChange: (priority: Ticket['priority']) => void;
}

export function TicketDetailsPanel({
  ticket,
  isOpen,
  onStatusChange,
  onPriorityChange,
}: TicketDetailsPanelProps) {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 space-y-4 sm:space-y-6"
    >
      <div>
        <h3 className="text-sm font-medium text-gray-500 mb-2">Status</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start text-sm sm:text-base"
            >
              <StatusIcon status={ticket.status} />
              <span className="ml-2 capitalize">{ticket.status}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[200px]">
            {Object.keys(statusColors).map((status) => (
              <DropdownMenuItem
                key={status}
                onClick={() => onStatusChange(status as Ticket['status'])}
                className="text-sm sm:text-base"
              >
                <StatusIcon status={status} />
                <span className="ml-2 capitalize">{status}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-500 mb-2">Priority</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start text-sm sm:text-base"
            >
              <AlertCircle className="h-4 w-4" />
              <span className="ml-2 uppercase">{ticket.priority}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[200px]">
            {Object.keys(priorityColors).map((priority) => (
              <DropdownMenuItem
                key={priority}
                onClick={() => onPriorityChange(priority as Ticket['priority'])}
                className="text-sm sm:text-base"
              >
                <AlertCircle className="h-4 w-4" />
                <span className="ml-2 uppercase">{priority}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-500 mb-2">Customer</h3>
        <div className="flex items-center gap-2 sm:gap-3">
          <Avatar className="w-8 h-8 sm:w-10 sm:h-10">
            <Image
              src={ticket.customer?.avatar_url || '/default-avatar.png'}
              alt={ticket.customer?.display_name || 'Customer'}
              width={40}
              height={40}
              className="rounded-full"
            />
          </Avatar>
          <div>
            <div className="font-medium text-gray-900 text-sm sm:text-base">
              {ticket.customer?.display_name || 'Unknown Customer'}
            </div>
            <div className="text-xs sm:text-sm text-gray-500">
              {ticket.customer?.email || 'No email'}
            </div>
          </div>
        </div>
      </div>

      {ticket.organization && (
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-2">Organization</h3>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <Building className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500" />
            </div>
            <div className="font-medium text-gray-900 text-sm sm:text-base">{ticket.organization.name}</div>
          </div>
        </div>
      )}
    </motion.div>
  );
} 