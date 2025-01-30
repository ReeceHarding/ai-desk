import { AIDraftPanel } from '@/components/ai-draft-panel';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Database } from '@/types/supabase';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useEffect, useState } from 'react';

type TicketEmailChat = Database['public']['Tables']['ticket_email_chats']['Row'] & {
  metadata?: {
    rag_references?: string[];
  };
};

export default function AIDraftsPage() {
  const [drafts, setDrafts] = useState<TicketEmailChat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = useSupabaseClient<Database>();

  useEffect(() => {
    const fetchDrafts = async () => {
      try {
        const { data, error } = await supabase
          .from('ticket_email_chats')
          .select('*')
          .not('ai_draft_response', 'is', null)
          .eq('ai_auto_responded', false)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setDrafts(data || []);
      } catch (error) {
        console.error('Error fetching drafts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDrafts();

    // Subscribe to changes
    const subscription = supabase
      .channel('ticket_email_chats_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'ticket_email_chats',
          filter: 'ai_draft_response.is.not.null'
        }, 
        () => {
          fetchDrafts();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const handleDraftSent = () => {
    // Refetch drafts after sending
    setDrafts(prev => prev.filter(d => !d.ai_auto_responded));
  };

  const handleDraftDiscarded = () => {
    // Refetch drafts after discarding
    setDrafts(prev => prev.filter(d => d.ai_draft_response !== null));
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="container mx-auto py-8">
          <h1 className="text-2xl font-bold mb-6">AI Drafts</h1>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-6">AI Drafts</h1>
        {drafts.length === 0 ? (
          <Card className="p-6 text-center text-gray-500">
            No AI drafts available
          </Card>
        ) : (
          <div className="space-y-4">
            {drafts.map((draft) => (
              <AIDraftPanel
                key={draft.id}
                ticketEmailChat={draft}
                onDraftSent={handleDraftSent}
                onDraftDiscarded={handleDraftDiscarded}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
} 