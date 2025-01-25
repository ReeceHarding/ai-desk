import { TicketSearch } from '@/components/tickets/TicketSearch';
import { Database } from '@/types/supabase';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import {
    AlertCircle,
    CheckCircle,
    Clock,
    EyeOff,
    Inbox,
    Lock
} from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

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
  ticket_email_chats: Array<{
    from_address: string | null;
    subject: string | null;
  }> | null;
  last_response_at?: string | null;
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

// Add a helper function to parse email address
const parseEmailAddress = (emailStr: string | null) => {
  if (!emailStr) return { name: null, email: null };
  
  // Match pattern: "Name <email@domain.com>" or just "email@domain.com"
  const match = emailStr.match(/^(?:([^<]*?)\s*<)?([^>]+)>?$/);
  if (!match) return { name: null, email: emailStr };
  
  const [, name, email] = match;
  return {
    name: name ? name.trim() : null,
    email: email.trim()
  };
};

export default function TicketsPage() {
  const [orgId, setOrgId] = useState<string | undefined>();
  const user = useUser();
  const supabase = useSupabaseClient<Database>();
  const router = useRouter();

  useEffect(() => {
    async function getOrgId() {
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (profile?.org_id) {
        setOrgId(profile.org_id);
      }
    }

    getOrgId();
  }, [user, supabase]);

  const handleTicketSelect = (ticket: any) => {
    router.push(`/tickets/${ticket.id}`);
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Tickets</h1>
      <TicketSearch orgId={orgId} onTicketSelect={handleTicketSelect} />
    </div>
  );
} 