import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Database } from "@/types/supabase";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { BookOpen, Bot, CheckCircle2, ChevronDown, ChevronUp, Mail, Send, Trash2 } from "lucide-react";
import { useState } from "react";

type TicketEmailChat = Database['public']['Tables']['ticket_email_chats']['Row'] & {
  metadata?: {
    rag_references?: string[];
    ai_reasoning?: string;
  };
  from_name?: string;
  from_address: string;
  subject: string;
  plain_text_body?: string;
  html_body?: string;
  thread_id: string;
  message_id: string;
  ticket_id: string;
  org_id: string;
  ai_confidence: number;
  ai_draft_response?: string;
  ai_auto_responded?: boolean;
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
  const [sent, setSent] = useState(false);
  const [showOriginalEmail, setShowOriginalEmail] = useState(false);
  const [showKnowledgeBase, setShowKnowledgeBase] = useState(false);
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
          fromAddress: 'me', // Gmail API uses 'me' to indicate the authenticated user
          toAddresses: Array.isArray(ticketEmailChat.from_address) 
            ? ticketEmailChat.from_address 
            : [ticketEmailChat.from_address],
          subject: `Re: ${ticketEmailChat.subject || 'Support Request'}`,
          htmlBody: ticketEmailChat.ai_draft_response,
          inReplyTo: ticketEmailChat.message_id,
          ticketId: ticketEmailChat.ticket_id,
          orgId: ticketEmailChat.org_id,
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

      setSent(true);
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
          {/* Original Email Section */}
          <div className="mb-4">
            <button
              onClick={() => setShowOriginalEmail(!showOriginalEmail)}
              className="flex items-center text-sm font-medium text-blue-900 hover:text-blue-700"
            >
              <Mail className="h-4 w-4 mr-2" />
              Original Email from {ticketEmailChat.from_name || ticketEmailChat.from_address}
              {showOriginalEmail ? (
                <ChevronUp className="h-4 w-4 ml-1" />
              ) : (
                <ChevronDown className="h-4 w-4 ml-1" />
              )}
            </button>
            
            {showOriginalEmail && (
              <div className="mt-2 p-3 bg-white rounded-md">
                <div className="text-sm text-gray-600">
                  <p><strong>From:</strong> {ticketEmailChat.from_name} &lt;{ticketEmailChat.from_address}&gt;</p>
                  <p><strong>Subject:</strong> {ticketEmailChat.subject}</p>
                  <div className="mt-2">
                    <strong>Message:</strong>
                    <div className="mt-1 whitespace-pre-wrap text-gray-700">{ticketEmailChat.plain_text_body || ticketEmailChat.html_body}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* AI Draft Section */}
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-blue-900">AI-Generated Draft Response</h3>
                <div className="text-xs text-blue-600 mt-1">
                  Confidence Score: {ticketEmailChat.ai_confidence.toFixed(2)}%
                </div>
              </div>
              <div className="flex items-center gap-2">
                {sent ? (
                  <div className="flex items-center text-green-600">
                    <CheckCircle2 className="h-5 w-5 mr-1" />
                    Sent!
                  </div>
                ) : (
                  <>
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
                      {sending ? 'Sending...' : 'Send Draft'}
                    </Button>
                  </>
                )}
              </div>
            </div>
            
            <div className="mt-2 text-sm text-blue-800 whitespace-pre-wrap">
              {ticketEmailChat.ai_draft_response}
            </div>

            {/* AI Reasoning Section */}
            {ticketEmailChat.metadata?.ai_reasoning && (
              <div className="mt-4 p-3 bg-white/50 rounded-md">
                <p className="text-sm font-medium text-blue-900 mb-1">AI Reasoning:</p>
                <p className="text-sm text-blue-700">{ticketEmailChat.metadata.ai_reasoning}</p>
              </div>
            )}
            
            {/* Knowledge Base References Section */}
            {ticketEmailChat.metadata?.rag_references && ticketEmailChat.metadata.rag_references.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setShowKnowledgeBase(!showKnowledgeBase)}
                  className="flex items-center text-sm font-medium text-blue-900 hover:text-blue-700"
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  Knowledge Base References ({ticketEmailChat.metadata.rag_references.length})
                  {showKnowledgeBase ? (
                    <ChevronUp className="h-4 w-4 ml-1" />
                  ) : (
                    <ChevronDown className="h-4 w-4 ml-1" />
                  )}
                </button>
                
                {showKnowledgeBase && (
                  <div className="mt-2 p-3 bg-white/50 rounded-md">
                    <div className="space-y-2">
                      {ticketEmailChat.metadata.rag_references.map((ref, index) => (
                        <div key={index} className="text-sm text-blue-700 p-2 bg-white/50 rounded">
                          {ref}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
} 