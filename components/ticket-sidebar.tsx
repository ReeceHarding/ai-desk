import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { AlertCircle, CheckCircle, ChevronRight, Clock, EyeOff, Inbox, Lock } from 'lucide-react';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { cn } from '../lib/utils';
import { Database } from '../types/supabase';
import { EmailThreadPanel } from './email-thread-panel';
import { TicketDetailsPanel } from './ticket-details-panel';
import { TicketInterface } from './ticket-interface';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Sheet, SheetContent } from './ui/sheet';
import { useToast } from './ui/use-toast';

type Ticket = Database['public']['Tables']['tickets']['Row'] & {
  customer: {
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
  organization: {
    name: string | null;
  } | null;
  metadata: {
    merged_into?: string;
    merged_from?: string;
    type?: string;
    [key: string]: any;
  };
};

interface TicketSidebarProps {
  ticket: Ticket;
  isOpen: boolean;
  onClose: () => void;
}

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

export function TicketSidebar({ ticket, isOpen, onClose }: TicketSidebarProps) {
  const router = useRouter();
  const supabase = useSupabaseClient<Database>();
  const { toast } = useToast();
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);
  const [isEmailThreadOpen, setIsEmailThreadOpen] = useState(false);
  const [isStarred, setIsStarred] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(true);
  const [statusToChange, setStatusToChange] = useState<Ticket['status'] | null>(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);

  const handleStatusChange = async (status: Ticket['status']) => {
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ status })
        .eq('id', ticket.id);

      if (error) throw error;

      toast({
        title: 'Status updated',
        description: `Ticket status changed to ${status}`,
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: 'Error updating status',
        description: error instanceof Error ? error.message : 'Failed to update status',
        variant: 'destructive',
      });
    }
  };

  const handlePriorityChange = async (priority: Ticket['priority']) => {
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ priority })
        .eq('id', ticket.id);

      if (error) throw error;

      toast({
        title: 'Priority updated',
        description: `Ticket priority changed to ${priority}`,
      });
    } catch (error) {
      console.error('Error updating priority:', error);
      toast({
        title: 'Error updating priority',
        description: error instanceof Error ? error.message : 'Failed to update priority',
        variant: 'destructive',
      });
    }
  };

  const handleAssigneeChange = async (assigneeId: string) => {
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ assigned_agent_id: assigneeId })
        .eq('id', ticket.id);

      if (error) throw error;

      toast({
        title: 'Assignee updated',
        description: 'Ticket assignee has been updated',
      });
    } catch (error) {
      console.error('Error updating assignee:', error);
      toast({
        title: 'Error updating assignee',
        description: error instanceof Error ? error.message : 'Failed to update assignee',
        variant: 'destructive',
      });
    }
  };

  const handleStatusSelect = (status: Ticket['status']) => {
    if (status === 'solved' || status === 'closed') {
      setStatusToChange(status);
      setShowStatusDialog(true);
    } else {
      handleStatusChange(status);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-[600px] p-0 bg-slate-900 border-l border-slate-800">
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto">
            <TicketInterface
              ticket={ticket}
              onStatusChange={handleStatusChange}
              onPriorityChange={handlePriorityChange}
              onAssigneeChange={handleAssigneeChange}
              isStarred={isStarred}
              onStarToggle={() => setIsStarred(!isStarred)}
              isSubscribed={isSubscribed}
              onSubscribeToggle={() => setIsSubscribed(!isSubscribed)}
            />
          </div>

          <div className="border-t border-slate-800 p-4 space-y-4">
            {/* Quick Status Controls */}
            <div className="space-y-2">
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

            {/* Priority Control */}
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
                      onClick={() => handlePriorityChange(priority as Ticket['priority'])}
                      className={`${priorityColors[priority]} hover:bg-slate-700/50`}
                    >
                      <AlertCircle className="h-4 w-4" />
                      <span className="ml-2 uppercase">{priority}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Details and Thread Buttons */}
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDetailsOpen(!isDetailsOpen)}
                className="flex-1"
              >
                {isDetailsOpen ? 'Hide Details' : 'Show Details'}
                <ChevronRight
                  className={`ml-2 h-4 w-4 transition-transform ${
                    isDetailsOpen ? 'rotate-90' : ''
                  }`}
                />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEmailThreadOpen(!isEmailThreadOpen)}
                className="flex-1"
              >
                {isEmailThreadOpen ? 'Hide Thread' : 'Show Thread'}
                <ChevronRight
                  className={`ml-2 h-4 w-4 transition-transform ${
                    isEmailThreadOpen ? 'rotate-90' : ''
                  }`}
                />
              </Button>
            </div>
          </div>

          {/* Status Change Dialog */}
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
                      handleStatusChange(statusToChange);
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

          {isDetailsOpen && (
            <TicketDetailsPanel
              ticket={ticket}
              isOpen={isDetailsOpen}
              onStatusChange={handleStatusChange}
              onPriorityChange={handlePriorityChange}
            />
          )}

          {isEmailThreadOpen && (
            <EmailThreadPanel
              isOpen={isEmailThreadOpen}
              onClose={() => setIsEmailThreadOpen(false)}
              ticket={{
                id: ticket.id,
                org_id: ticket.org_id,
                thread_id: ticket.metadata.thread_id || undefined,
                message_id: ticket.metadata.message_id || undefined,
                subject: ticket.subject,
                customer_email: ticket.customer?.email || undefined,
              }}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
} 