import { Database } from '@/types/supabase';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

type EmailDraft = Database['public']['Tables']['ticket_email_chats']['Row'] & {
  metadata?: {
    confidence?: number;
    context_used?: string[];
  };
};

export function useDrafts() {
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponentClient<Database>();

  const fetchDrafts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('ticket_email_chats')
        .select('*')
        .is('ai_auto_responded', false)
        .is('ai_draft_discarded', false)
        .not('ai_draft_response', 'is', null)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setDrafts(data || []);
    } catch (error: any) {
      console.error('Error fetching drafts:', error);
      toast.error('Failed to fetch drafts');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const sendDraft = useCallback(async (chatId: string) => {
    try {
      const response = await fetch('/api/gmail/send-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatId }),
      });

      if (!response.ok) {
        throw new Error('Failed to send draft');
      }

      toast.success('Draft sent successfully');
      await fetchDrafts();
    } catch (error: any) {
      console.error('Error sending draft:', error);
      toast.error('Failed to send draft');
    }
  }, [fetchDrafts]);

  const discardDraft = useCallback(async (chatId: string) => {
    try {
      const response = await fetch('/api/gmail/discard-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatId }),
      });

      if (!response.ok) {
        throw new Error('Failed to discard draft');
      }

      toast.success('Draft discarded');
      await fetchDrafts();
    } catch (error: any) {
      console.error('Error discarding draft:', error);
      toast.error('Failed to discard draft');
    }
  }, [fetchDrafts]);

  useEffect(() => {
    fetchDrafts();

    // Subscribe to changes
    const channel = supabase
      .channel('ticket_email_chats_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_email_chats',
        },
        () => {
          fetchDrafts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchDrafts]);

  return {
    drafts,
    loading,
    sendDraft,
    discardDraft,
    refetch: fetchDrafts,
  };
} 