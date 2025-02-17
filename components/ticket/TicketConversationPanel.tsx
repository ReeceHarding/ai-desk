import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { sendDraftResponse } from '@/utils/ai-email-processor';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { AlertTriangle, Bot, Send, Trash2 } from 'lucide-react';
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
    ai_confidence: number;
  } | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClientComponentClient();
  const { toast } = useToast();

  useEffect(() => {
    if (!ticket?.id) return;

    const fetchAiDraft = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('ticket_email_chats')
          .select('id, ai_draft_response, metadata, ai_confidence')
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
          // Don't show draft if email was promotional
          if (data.metadata?.promotional) {
            setAiDraft(null);
          } else {
            setAiDraft(data);
          }
        }
      } catch (error) {
        console.error('Error in fetchAiDraft:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAiDraft();
  }, [ticket?.id]);

  const handleSendDraft = async () => {
    if (!aiDraft) return;

    setIsSending(true);
    try {
      // Send the draft using the AI email processor
      await sendDraftResponse(aiDraft.id);

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
    } finally {
      setIsSending(false);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* AI Draft Section */}
      {aiDraft && (
        <Card className="p-4 border-primary/20 bg-primary/5">
          <div className="flex items-start gap-3">
            <Bot className="w-6 h-6 text-primary" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">AI Draft Response</h3>
                {aiDraft.ai_confidence < 0.7 && (
                  <div className="flex items-center text-yellow-600 text-sm">
                    <AlertTriangle className="w-4 h-4 mr-1" />
                    Low confidence
                  </div>
                )}
              </div>
              <div className="prose prose-sm max-w-none mb-4 whitespace-pre-wrap">
                {aiDraft.ai_draft_response}
              </div>
              {aiDraft.metadata?.rag_references && (
                <div className="text-xs text-gray-500 mb-4">
                  Based on {aiDraft.metadata.rag_references.length} knowledge base references
                </div>
              )}
              {aiDraft.ai_confidence && (
                <div className="text-xs text-gray-500 mb-4">
                  AI Confidence: {Math.round(aiDraft.ai_confidence * 100)}%
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDiscardDraft}
                  disabled={isSending}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Discard
                </Button>
                <Button
                  size="sm"
                  onClick={handleSendDraft}
                  disabled={isSending}
                >
                  <Send className="w-4 h-4 mr-1" />
                  {isSending ? 'Sending...' : 'Send Response'}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
} 
