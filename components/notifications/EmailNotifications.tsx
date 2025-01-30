import { Database } from '@/types/supabase';
import { useToast } from '@chakra-ui/react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useEffect } from 'react';

export function EmailNotifications() {
  const supabase = useSupabaseClient<Database>();
  const user = useUser();
  const toast = useToast();

  useEffect(() => {
    if (!user) return;

    // Subscribe to new ticket_email_chats
    const emailChatsSubscription = supabase
      .channel('email-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_email_chats',
          filter: `org_id=eq.${user.id}`
        },
        async (payload) => {
          const { new: newChat } = payload;
          
          // Get ticket details
          const { data: ticket } = await supabase
            .from('tickets')
            .select('subject')
            .eq('id', newChat.ticket_id)
            .single();

          toast({
            title: 'New Email Message',
            description: `${newChat.from_name || newChat.from_address}: ${ticket?.subject || 'No Subject'}`,
            status: 'info',
            duration: 5000,
            isClosable: true,
            position: 'top-right',
          });
        }
      )
      .subscribe();

    // Subscribe to ticket status changes
    const ticketSubscription = supabase
      .channel('ticket-notifications')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tickets',
          filter: `org_id=eq.${user.id}`
        },
        (payload) => {
          const { new: newTicket, old: oldTicket } = payload;
          
          if (newTicket.status !== oldTicket.status) {
            toast({
              title: 'Ticket Status Updated',
              description: `Ticket #${newTicket.id}: Status changed to ${newTicket.status}`,
              status: 'info',
              duration: 5000,
              isClosable: true,
              position: 'top-right',
            });
          }
        }
      )
      .subscribe();

    // Cleanup subscriptions
    return () => {
      emailChatsSubscription.unsubscribe();
      ticketSubscription.unsubscribe();
    };
  }, [supabase, user, toast]);

  return null; // This is a background component
} 