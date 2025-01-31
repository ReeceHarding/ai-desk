import { useToast } from '@/components/ui/use-toast';
import { Database } from '@/types/supabase';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useEffect } from 'react';

export function EmailNotifications() {
  const supabase = useSupabaseClient<Database>();
  const user = useUser();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('email_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_email_chats',
          filter: `org_id=eq.${user.id}`,
        },
        (payload) => {
          const newEmail = payload.new as Database['public']['Tables']['ticket_email_chats']['Row'];
          
          if (newEmail.type === 'inbound') {
            toast({
              title: 'New Email Received',
              description: `From: ${newEmail.from_name || newEmail.from_address}`,
              variant: 'default'
            });
          } else {
            toast({
              title: 'Email Sent',
              description: `To: ${newEmail.to_address?.join(', ')}`,
              variant: 'default'
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, user, toast]);

  return null; // This is a background component
} 