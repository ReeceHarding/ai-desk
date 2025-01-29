import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Database } from "@/types/supabase";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { Bot, Send, Trash2 } from "lucide-react";
import { useState } from "react";

type TicketEmailChat = Database['public']['Tables']['ticket_email_chats']['Row'] & {
  metadata?: {
    rag_references?: string[];
  };
};

interface AIDraftPanelProps {
  ticketEmailChat: TicketEmailChat;
  onDraftSent: () => void;
  onDraftDiscarded: () => void;
}

export function AIDraftPanel({
  ticketEmailChat,
  onDraftSent,
  onDraftDiscarded,
}: AIDraftPanelProps) {
  const [sending, setSending] = useState(false);
  const supabase = useSupabaseClient<Database>();
  const { toast } = useToast();

  const handleSendDraft = async () => {
    if (!ticketEmailChat.ai_draft_response) return;
    
    try {
      setSending(true);

      // Send the email via Gmail API endpoint
      const response = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          threadId: ticketEmailChat.thread_id,
          inReplyTo: ticketEmailChat.message_id,
          to: Array.isArray(ticketEmailChat.from_address) 
            ? ticketEmailChat.from_address 
            : [ticketEmailChat.from_address],
          subject: `Re: ${ticketEmailChat.subject || 'Support Request'}`,
          htmlBody: ticketEmailChat.ai_draft_response,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send email: ${response.statusText}`);
      }

      // Update the record
      await supabase
        .from('ticket_email_chats')
        .update({
          ai_auto_responded: true,
        })
        .eq('id', ticketEmailChat.id);

      toast({
        title: "Draft sent successfully",
        description: "The AI-generated response has been sent.",
      });

      onDraftSent();
    } catch (error) {
      console.error('Failed to send draft:', error);
      toast({
        title: "Failed to send draft",
        description: "There was an error sending the AI-generated response.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleDiscardDraft = async () => {
    try {
      await supabase
        .from('ticket_email_chats')
        .update({
          ai_draft_response: null,
        })
        .eq('id', ticketEmailChat.id);

      toast({
        title: "Draft discarded",
        description: "The AI-generated draft has been discarded.",
      });

      onDraftDiscarded();
    } catch (error) {
      console.error('Failed to discard draft:', error);
      toast({
        title: "Failed to discard draft",
        description: "There was an error discarding the AI-generated draft.",
        variant: "destructive",
      });
    }
  };

  if (!ticketEmailChat.ai_draft_response || ticketEmailChat.ai_auto_responded) {
    return null;
  }

  return (
    <Card className="p-4 bg-blue-50 border-blue-200">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-blue-100 rounded-full">
          <Bot className="h-5 w-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-blue-900">AI-Generated Draft Response</h3>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDiscardDraft}
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-100"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Discard
              </Button>
              <Button
                size="sm"
                onClick={handleSendDraft}
                disabled={sending}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                <Send className="h-4 w-4 mr-1" />
                Send Draft
              </Button>
            </div>
          </div>
          <div className="mt-2 text-sm text-blue-800 whitespace-pre-wrap">
            {ticketEmailChat.ai_draft_response}
          </div>
          {ticketEmailChat.metadata?.rag_references && (
            <div className="mt-2 text-xs text-blue-600">
              Based on {(ticketEmailChat.metadata.rag_references as string[]).length} knowledge base references
            </div>
          )}
        </div>
      </div>
    </Card>
  );
} 