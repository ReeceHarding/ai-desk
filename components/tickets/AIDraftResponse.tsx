import { Button } from '@/components/ui/button';
import { Database } from '@/types/supabase';
import { logger } from '@/utils/logger';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useState } from 'react';

const supabase = createClientComponentClient<Database>();

interface AIDraftResponseProps {
  chatId: string;
  ticketId: string;
  threadId: string;
  messageId: string;
  fromAddress: string;
  subject: string;
  draftResponse: string;
  onSent?: () => void;
  onDiscarded?: () => void;
}

export function AIDraftResponse({
  chatId,
  ticketId,
  threadId,
  messageId,
  fromAddress,
  subject,
  draftResponse,
  onSent,
  onDiscarded,
}: AIDraftResponseProps) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendDraft = async () => {
    setSending(true);
    setError(null);

    try {
      // Send the email via Gmail API endpoint
      const response = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          threadId,
          inReplyTo: messageId,
          to: [fromAddress],
          subject: `Re: ${subject}`,
          htmlBody: draftResponse,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send email: ${response.statusText}`);
      }

      // Update the chat record
      const { error: updateError } = await supabase
        .from('ticket_email_chats')
        .update({
          ai_auto_responded: true,
        })
        .eq('id', chatId);

      if (updateError) throw updateError;

      logger.info('Sent AI draft response', { chatId, ticketId });
      onSent?.();
    } catch (err) {
      logger.error('Failed to send AI draft', { error: err });
      setError('Failed to send email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleDiscard = async () => {
    try {
      // Clear the draft
      const { error: updateError } = await supabase
        .from('ticket_email_chats')
        .update({
          ai_draft_response: null,
        })
        .eq('id', chatId);

      if (updateError) {
        throw updateError;
      }

      logger.info('Discarded AI draft response', { chatId });
      onDiscarded?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to discard response';
      setError(message);
      logger.error('Failed to discard AI draft', { error: err });
    }
  };

  return (
    <div className="mt-4 p-4 border border-slate-300 bg-slate-50 rounded-md text-slate-800">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-bold">AI Draft Response</h4>
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
      </div>
      
      <div className="mb-4 whitespace-pre-wrap bg-white p-3 rounded border border-slate-200">
        {draftResponse}
      </div>

      <div className="flex gap-2">
        <Button 
          onClick={handleSendDraft}
          disabled={sending}
        >
          {sending ? 'Sending...' : 'Send This Draft'}
        </Button>
        <Button 
          variant="outline"
          onClick={handleDiscard}
          disabled={sending}
        >
          Discard
        </Button>
      </div>
    </div>
  );
} 