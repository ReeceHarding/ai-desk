import { Database } from '@/types/supabase';
import { logger } from '@/utils/logger';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';

interface DraftManagerProps {
  chatId: string;
  initialDraft?: string;
  children: (props: {
    draft: string | null;
    setDraft: (draft: string | null) => Promise<void>;
    isSaving: boolean;
    error: string | null;
  }) => React.ReactNode;
}

export function DraftManager({ chatId, initialDraft, children }: DraftManagerProps) {
  const [draft, setDraftState] = useState<string | null>(initialDraft || null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponentClient<Database>();

  // Load draft when chatId changes
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const { data: chat, error: chatError } = await supabase
          .from('ticket_email_chats')
          .select('ai_draft_response')
          .eq('id', chatId)
          .single();

        if (chatError) throw chatError;
        setDraftState(chat?.ai_draft_response || null);
      } catch (err) {
        logger.error('Failed to load draft', { error: err, chatId });
        setError('Failed to load draft');
      }
    };

    loadDraft();
  }, [chatId]);

  // Function to update draft in state and database
  const setDraft = async (newDraft: string | null) => {
    setIsSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('ticket_email_chats')
        .update({
          ai_draft_response: newDraft
        })
        .eq('id', chatId);

      if (updateError) throw updateError;
      setDraftState(newDraft);
      logger.info('Draft saved successfully', { chatId });
    } catch (err) {
      logger.error('Failed to save draft', { error: err, chatId });
      setError('Failed to save draft');
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  return children({
    draft,
    setDraft,
    isSaving,
    error
  });
} 