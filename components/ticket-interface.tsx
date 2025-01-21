import { motion } from 'framer-motion';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { Database } from '@/types/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Star,
  Bell,
  BellOff,
  Share2,
  MoreHorizontal,
  Clock,
  EyeOff,
  CheckCircle,
  Lock,
  Inbox,
  AlertCircle,
  Building,
  Calendar,
  ChevronLeft,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { TicketDetailsPanel } from './ticket-details-panel';
import { TicketConversationPanel } from './ticket-conversation-panel';

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
  const [showDetails, setShowDetails] = useState(true);
  const [showConversation, setShowConversation] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-white">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => router.push('/tickets')}
              className="text-slate-400 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to tickets
            </Button>
            <h1 className="text-2xl font-semibold">Ticket #{ticket.id}</h1>
            <Badge className={statusColors[ticket.status]}>
              <StatusIcon status={ticket.status} />
              <span className="ml-1 capitalize">{ticket.status}</span>
            </Badge>
            <Badge className={priorityColors[ticket.priority]}>
              {ticket.priority.toUpperCase()}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onStarToggle}
                    className={isStarred ? 'text-yellow-400' : 'text-slate-400 hover:text-yellow-400'}
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
                    className="text-slate-400 hover:text-white"
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
                    className="text-slate-400 hover:text-white"
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
                    className="text-slate-400 hover:text-white"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>Edit ticket</DropdownMenuItem>
                  <DropdownMenuItem className="text-red-500">Delete ticket</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TooltipProvider>
          </div>
        </div>

        {/* Main content */}
        <div className="grid grid-cols-3 gap-8">
          {/* Left column - Ticket details */}
          <div className="col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 space-y-4"
            >
              <h2 className="text-xl font-semibold">{ticket.subject}</h2>
              <p className="text-slate-300">{ticket.description}</p>
              <div className="flex items-center gap-4 text-sm text-slate-400">
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
              isOpen={showConversation}
              onClose={() => setShowConversation(false)}
            />
          </div>

          {/* Right column - Details Panel */}
          <TicketDetailsPanel
            ticket={ticket}
            isOpen={showDetails}
            onClose={() => setShowDetails(false)}
            onStatusChange={onStatusChange}
            onPriorityChange={onPriorityChange}
          />
        </div>
      </div>
    </div>
  );
} 