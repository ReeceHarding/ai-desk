import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface TicketCardProps {
  ticket: {
    id: string;
    subject: string;
    status: string;
    priority: string;
    created_at: string;
    customer?: {
      display_name: string | null;
      email: string | null;
      avatar_url: string | null;
    } | null;
    organization?: {
      name: string | null;
    } | null;
  };
  onClick?: () => void;
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

export function TicketCard({ ticket, onClick }: TicketCardProps) {
  const timeAgo = ticket.created_at ? formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true }) : '';
  
  return (
    <div 
      onClick={onClick}
      className="p-4 bg-white border-b last:border-b-0 hover:bg-gray-50 cursor-pointer active:bg-gray-100 transition-colors"
    >
      {/* Top Row - Status, Priority, Time */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Badge variant="secondary" className={statusColors[ticket.status]}>
            {ticket.status}
          </Badge>
          <Badge variant="secondary" className={priorityColors[ticket.priority]}>
            {ticket.priority}
          </Badge>
        </div>
        <span className="text-xs text-gray-500">{timeAgo}</span>
      </div>

      {/* Subject */}
      <h3 className="text-sm font-medium text-gray-900 mb-2 line-clamp-2">
        {ticket.subject}
      </h3>

      {/* Bottom Row - Customer & Organization */}
      <div className="flex items-center space-x-3">
        <Avatar className="h-6 w-6">
          <AvatarImage src={ticket.customer?.avatar_url || undefined} />
          <AvatarFallback>
            {ticket.customer?.display_name?.charAt(0) || ticket.customer?.email?.charAt(0) || '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-900 truncate">
            {ticket.customer?.display_name || ticket.customer?.email || 'Unknown'}
          </p>
          {ticket.organization?.name && (
            <p className="text-xs text-gray-500 truncate">
              at {ticket.organization.name}
            </p>
          )}
        </div>
      </div>
    </div>
  );
} 