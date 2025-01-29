import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Bot } from 'lucide-react';
import { useEffect, useState } from 'react';

interface TicketConversationPanelProps {
  ticket: {
    id: string;
    [key: string]: any;
  } | null;
  isOpen: boolean;
}

export function TicketConversationPanel({ ticket, isOpen }: TicketConversationPanelProps) {
  const [aiDraft, setAiDraft] = useState<{
    id: string;
    ai_draft_response: string;
    metadata: any;
  } | null>(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    if (!ticket?.id) return;

    const fetchAiDraft = async () => {
      const { data, error } = await supabase
        .from('ticket_email_chats')
        .select('id, ai_draft_response, metadata')
        .eq('ticket_id', ticket.id)
        .eq('ai_auto_responded', false)
        .not('ai_draft_response', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error('Error fetching AI draft:', error);
        return;
      }

      if (data) {
        setAiDraft(data);
      }
    };

    fetchAiDraft();
  }, [ticket?.id]);

  const handleSendDraft = async () => {
    if (!aiDraft) return;

    try {
      // Update the record to mark it as sent
      const { error: updateError } = await supabase
        .from('ticket_email_chats')
        .update({ ai_auto_responded: true })
        .eq('id', aiDraft.id);

      if (updateError) throw updateError;

      toast({
        title: 'Draft sent successfully',
        description: 'The AI response has been sent to the customer.',
      });

      setAiDraft(null);
    } catch (error) {
      console.error('Error sending draft:', error);
      toast({
        title: 'Error sending draft',
        description: 'Failed to send the AI response. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDiscardDraft = async () => {
    if (!aiDraft) return;

    try {
      // Update the record to clear the draft
      const { error: updateError } = await supabase
        .from('ticket_email_chats')
        .update({ ai_draft_response: null })
        .eq('id', aiDraft.id);

      if (updateError) throw updateError;

      toast({
        title: 'Draft discarded',
        description: 'The AI response has been discarded.',
      });

      setAiDraft(null);
    } catch (error) {
      console.error('Error discarding draft:', error);
      toast({
        title: 'Error discarding draft',
        description: 'Failed to discard the AI response. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Existing conversation content */}
      
      {/* AI Draft Section */}
      {aiDraft && (
        <Card className="p-4 border-primary/20 bg-primary/5">
          <div className="flex items-start gap-3">
            <Bot className="w-6 h-6 text-primary" />
            <div className="flex-1">
              <h3 className="font-medium mb-2">AI Draft Response</h3>
              <div className="prose prose-sm max-w-none mb-4">
                {aiDraft.ai_draft_response}
              </div>
              {aiDraft.metadata?.rag_references && (
                <div className="text-xs text-gray-500 mb-4">
                  Based on {aiDraft.metadata.rag_references.length} knowledge base references
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDiscardDraft}
                >
                  Discard
                </Button>
                <Button
                  size="sm"
                  onClick={handleSendDraft}
                >
                  Send Response
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
} 
