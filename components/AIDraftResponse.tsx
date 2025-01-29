import { Database } from '@/types/supabase';
import { sendDraftResponse } from '@/utils/ai-email-processor';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useState } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { toast } from './ui/use-toast';

interface AIDraftResponseProps {
  chatId: string;
  draftResponse: string;
  onSent?: () => void;
}

export function AIDraftResponse({ chatId, draftResponse, onSent }: AIDraftResponseProps) {
  const [sending, setSending] = useState(false);
  const supabase = createClientComponentClient<Database>();

  const handleSendDraft = async () => {
    try {
      setSending(true);
      await sendDraftResponse(chatId);
      toast({
        title: 'Draft sent successfully',
        description: 'The AI-generated response has been sent.',
      });
      onSent?.();
    } catch (error) {
      console.error('Error sending draft:', error);
      toast({
        title: 'Error sending draft',
        description: 'Failed to send the AI-generated response. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleDiscard = async () => {
    try {
      await supabase
        .from('ticket_email_chats')
        .update({
          ai_draft_response: null,
        })
        .eq('id', chatId);

      toast({
        title: 'Draft discarded',
        description: 'The AI-generated response has been discarded.',
      });
      onSent?.();
    } catch (error) {
      console.error('Error discarding draft:', error);
      toast({
        title: 'Error discarding draft',
        description: 'Failed to discard the AI-generated response. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="mt-4 p-4 bg-slate-50 border border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-slate-700">AI-Generated Draft Response</h4>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={handleSendDraft}
            disabled={sending}
          >
            {sending ? 'Sending...' : 'Send Draft'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDiscard}
            disabled={sending}
          >
            Discard
          </Button>
        </div>
      </div>
      <div className="prose prose-slate max-w-none mt-2">
        <div
          className="text-slate-600 whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: draftResponse }}
        />
      </div>
    </Card>
  );
} 