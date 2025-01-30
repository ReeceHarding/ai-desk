import { Button } from '@/components/ui/button';
import { Database } from '@/types/supabase';
import { logger } from '@/utils/logger';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useState } from 'react';

interface AIDraftResponseProps {
  chatId: string;
  ticketId: string;
  threadId: string;
  messageId: string;
  fromAddress: string;
  subject: string;
  draftResponse: string;
  onSent?: () => void;
}

const supabase = createClientComponentClient<Database>();

export function AIDraftResponse({
  chatId,
  ticketId,
  threadId,
  messageId,
  fromAddress,
  subject,
  draftResponse,
  onSent,
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
      await supabase
        .from('ticket_email_chats')
        .update({
          ai_draft_response: null,
        })
        .eq('id', chatId);

      onSent?.();
    } catch (err) {
      logger.error('Failed to discard AI draft', { error: err });
      setError('Failed to discard draft. Please try again.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-medium mb-2">AI Draft Response:</h4>
        <p className="whitespace-pre-wrap text-gray-700">{draftResponse}</p>
      </div>

      {error && (
        <div className="text-red-600 text-sm p-2 bg-red-50 rounded">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          onClick={handleSendDraft}
          disabled={sending}
        >
          {sending ? 'Sending...' : 'Send Draft'}
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
