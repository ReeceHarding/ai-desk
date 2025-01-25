import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Database } from '@/types/supabase';
import { format, formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import {
    AlertCircle,
    Bell,
    BellOff,
    Calendar,
    CheckCircle,
    ChevronLeft,
    Clock,
    EyeOff,
    Inbox,
    Lock,
    Mail,
    MoreHorizontal,
    Share2,
    Star,
} from 'lucide-react';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { EmailThreadPanel } from './email-thread-panel';
import { TicketConversationPanel } from './ticket-conversation-panel';
import { TicketDetailsPanel } from './ticket-details-panel';

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

interface TicketInterfaceProps {
  ticket: Ticket;
  onStatusChange: (status: Ticket['status']) => void;
  onPriorityChange: (priority: Ticket['priority']) => void;
  isStarred?: boolean;
  onStarToggle?: () => void;
  isSubscribed?: boolean;
  onSubscribeToggle?: () => void;
}

export function TicketInterface({
  ticket,
  onStatusChange,
  onPriorityChange,
  isStarred = false,
  onStarToggle,
  isSubscribed = true,
  onSubscribeToggle,
}: TicketInterfaceProps) {
  const router = useRouter();
  const [isEmailPanelOpen, setIsEmailPanelOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <span className="ml-2">Loading ticket...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-7xl mx-auto p-6">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="border-b border-gray-200 bg-white px-3 py-3 sm:px-6 sm:py-4 lg:px-8">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Button
                    variant="ghost"
                    onClick={() => router.push('/tickets')}
                    className="text-gray-600 hover:text-gray-900 w-fit"
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Ticket #{ticket.id}</h1>
                    <div className="flex items-center gap-2">
                      <Badge variant={ticket.status === 'open' ? 'default' : 'secondary'}>
                        <StatusIcon status={ticket.status} />
                        <span className="ml-1 capitalize">{ticket.status}</span>
                      </Badge>
                      <Badge variant={ticket.priority === 'high' ? 'destructive' : 'secondary'}>
                        {ticket.priority}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setIsEmailPanelOpen(true)}
                          className="text-gray-600 hover:text-gray-900 shrink-0"
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>View Email Thread</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={onStarToggle}
                          className={`${isStarred ? 'text-yellow-500' : 'text-gray-600 hover:text-yellow-500'} shrink-0`}
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{isStarred ? 'Remove from starred' : 'Add to starred'}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={onSubscribeToggle}
                          className="text-gray-600 hover:text-gray-900 shrink-0"
                        >
                          {isSubscribed ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isSubscribed ? 'Unsubscribe from notifications' : 'Subscribe to notifications'}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-gray-600 hover:text-gray-900 shrink-0"
                        >
                          <Share2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Share ticket</TooltipContent>
                    </Tooltip>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-gray-600 hover:text-gray-900 shrink-0"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Edit ticket</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">Delete ticket</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TooltipProvider>
                </div>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 overflow-auto px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
              {/* Left column - Ticket details */}
              <div className="lg:col-span-2">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 space-y-4"
                >
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900">{ticket.subject}</h2>
                  <p className="text-gray-600 text-sm sm:text-base">{ticket.description}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(ticket.created_at), 'PPP')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </motion.div>

                {/* Conversation Panel */}
                <TicketConversationPanel
                  ticket={ticket}
                  isOpen={true}
                />
              </div>

              {/* Right column - Details Panel */}
              <div className="lg:block">
                <TicketDetailsPanel
                  ticket={ticket}
                  isOpen={true}
                  onStatusChange={onStatusChange}
                  onPriorityChange={onPriorityChange}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Email Thread Panel */}
        <EmailThreadPanel
          isOpen={isEmailPanelOpen}
          onClose={() => setIsEmailPanelOpen(false)}
          ticket={{ id: ticket.id, org_id: ticket.org_id }}
        />
      </div>
    </div>
  );
} 