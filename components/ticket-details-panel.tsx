import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
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
import { useState } from 'react';

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

const statusDescriptions: Record<string, string> = {
  open: 'We are working on it',
  pending: 'We are waiting on something else',
  on_hold: 'The ticket is temporarily on hold',
  solved: 'Customer or agent marked as solved',
  closed: 'Fully closed - read-only',
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
  const [statusToChange, setStatusToChange] = useState<Ticket['status'] | null>(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);

  const handleStatusSelect = (status: Ticket['status']) => {
    if (status === 'solved' || status === 'closed') {
      setStatusToChange(status);
      setShowStatusDialog(true);
    } else {
      onStatusChange(status);
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn("bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 space-y-6")}
    >
      {/* Status Controls */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-slate-400">Quick Status Update</h3>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={() => handleStatusSelect('open')}
            className={cn("justify-start hover:bg-slate-700/50 transition-colors", ticket.status === 'open' ? statusColors.open : '')}
          >
            <Inbox className="h-4 w-4 mr-2" />
            Open
          </Button>
          <Button
            variant="outline"
            onClick={() => handleStatusSelect('pending')}
            className={cn("justify-start hover:bg-slate-700/50 transition-colors", ticket.status === 'pending' ? statusColors.pending : '')}
          >
            <Clock className="h-4 w-4 mr-2" />
            Pending
          </Button>
          <Button
            variant="outline"
            onClick={() => handleStatusSelect('solved')}
            className={cn("justify-start hover:bg-slate-700/50 transition-colors", ticket.status === 'solved' ? statusColors.solved : '')}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Solved
          </Button>
          <Button
            variant="outline"
            onClick={() => handleStatusSelect('closed')}
            className={cn("justify-start hover:bg-slate-700/50 transition-colors", ticket.status === 'closed' ? statusColors.closed : '')}
          >
            <Lock className="h-4 w-4 mr-2" />
            Closed
          </Button>
        </div>
      </div>

      {/* Current Status Dropdown */}
      <div>
        <h3 className="text-sm font-medium text-slate-400 mb-2">Current Status</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className={cn("w-full justify-start hover:bg-slate-700/50 transition-colors", statusColors[ticket.status])}
            >
              <StatusIcon status={ticket.status} />
              <span className="ml-2 capitalize">{ticket.status}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-slate-800 border-slate-700">
            {Object.keys(statusColors).map((status) => (
              <DropdownMenuItem
                key={status}
                onClick={() => handleStatusSelect(status as Ticket['status'])}
                className={cn(statusColors[status], "hover:bg-slate-700/50")}
              >
                <StatusIcon status={status} />
                <div className="ml-2">
                  <div className="capitalize">{status}</div>
                  <div className="text-xs text-slate-400">{statusDescriptions[status]}</div>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <AlertDialogContent className="bg-slate-800 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-100">
              {statusToChange === 'solved' ? 'Mark Ticket as Solved?' : 'Close Ticket?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {statusToChange === 'solved' 
                ? 'This will mark the ticket as solved. The customer can still reopen it if they need further assistance.'
                : 'This will close the ticket permanently. No further comments can be added after closing.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-700 hover:bg-slate-600 text-slate-100">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (statusToChange) {
                  onStatusChange(statusToChange);
                }
                setShowStatusDialog(false);
              }}
              className={statusToChange === 'solved' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'}
            >
              {statusToChange === 'solved' ? 'Mark as Solved' : 'Close Ticket'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div>
        <h3 className="text-sm font-medium text-slate-400 mb-2">Priority</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className={`w-full justify-start hover:bg-slate-700/50 transition-colors ${priorityColors[ticket.priority]}`}
            >
              <AlertCircle className="h-4 w-4" />
              <span className="ml-2 uppercase">{ticket.priority}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-slate-800 border-slate-700">
            {Object.keys(priorityColors).map((priority) => (
              <DropdownMenuItem
                key={priority}
                onClick={() => onPriorityChange(priority as Ticket['priority'])}
                className={`${priorityColors[priority]} hover:bg-slate-700/50`}
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
            <Image
              src={ticket.customer?.avatar_url || 'https://placehold.co/400x400/png?text=👤'}
              alt={ticket.customer?.display_name || 'Customer'}
              width={40}
              height={40}
              className="rounded-full"
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