import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  AlertCircle,
  Building,
  Clock,
  EyeOff,
  CheckCircle,
  Lock,
  Inbox,
} from 'lucide-react';
import { Database } from '@/types/supabase';

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
  onClose: () => void;
  onStatusChange: (status: Ticket['status']) => void;
  onPriorityChange: (priority: Ticket['priority']) => void;
}

export function TicketDetailsPanel({
  ticket,
  isOpen,
  onClose,
  onStatusChange,
  onPriorityChange,
}: TicketDetailsPanelProps) {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 space-y-6"
    >
      <div>
        <h3 className="text-sm font-medium text-slate-400 mb-2">Status</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className={`w-full justify-start ${statusColors[ticket.status]}`}
            >
              <StatusIcon status={ticket.status} />
              <span className="ml-2 capitalize">{ticket.status}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {Object.keys(statusColors).map((status) => (
              <DropdownMenuItem
                key={status}
                onClick={() => onStatusChange(status as Ticket['status'])}
              >
                <StatusIcon status={status} />
                <span className="ml-2 capitalize">{status}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div>
        <h3 className="text-sm font-medium text-slate-400 mb-2">Priority</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className={`w-full justify-start ${priorityColors[ticket.priority]}`}
            >
              <AlertCircle className="h-4 w-4" />
              <span className="ml-2 uppercase">{ticket.priority}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {Object.keys(priorityColors).map((priority) => (
              <DropdownMenuItem
                key={priority}
                onClick={() => onPriorityChange(priority as Ticket['priority'])}
              >
                <AlertCircle className="h-4 w-4" />
                <span className="ml-2 uppercase">{priority}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div>
        <h3 className="text-sm font-medium text-slate-400 mb-2">Customer</h3>
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
            <div className="text-sm text-slate-400">
              {ticket.customer?.email || 'No email'}
            </div>
          </div>
        </div>
      </div>

      {ticket.organization && (
        <div>
          <h3 className="text-sm font-medium text-slate-400 mb-2">Organization</h3>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-slate-700 flex items-center justify-center">
              <Building className="h-5 w-5 text-slate-400" />
            </div>
            <div className="font-medium">{ticket.organization.name}</div>
          </div>
        </div>
      )}
    </motion.div>
  );
} 