import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Database } from "@/types/supabase"
import { useSupabaseClient } from "@supabase/auth-helpers-react"
import { formatDistanceToNow } from "date-fns"
import { OAuth2Client } from "google-auth-library"
import { Loader2, Mail, Paperclip, Send, Smile, X } from "lucide-react"
import md5 from "md5"
import { useEffect, useRef, useState } from "react"
import { useInView } from "react-intersection-observer"

interface EmailMessage {
  id: string
  ticket_id: string
  message_id: string
  thread_id: string
  from_name: string | null
  from_address: string
  to_address: string[]
  cc_address: string[]
  bcc_address: string[]
  subject: string | null
  body: string
  attachments: any
  gmail_date: string
  org_id: string
  ai_classification: 'should_respond' | 'no_response' | 'unknown'
  ai_confidence: number
  ai_auto_responded: boolean
  ai_draft_response: string | null
  created_at: string
  updated_at: string
}

export interface EmailThreadPanelProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: {
    id: string;
    thread_id?: string | null;
    message_id?: string | null;
    subject?: string | null;
  } | null;
}

export function EmailThreadPanel({ isOpen, onClose, ticket }: EmailThreadPanelProps) {
  const [messages, setMessages] = useState<EmailMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const { ref, inView } = useInView()
  const supabase = useSupabaseClient<Database>()
  const oauthClientRef = useRef<OAuth2Client | null>(null)
  const limit = 20
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)

  const fetchMessages = async (pageNum: number) => {
    if (!ticket?.id || isLoading) {
      console.log("Skipping fetch:", { ticketId: ticket?.id, isLoading });
      return;
    }
    setIsLoading(true);
    try {
      const from = pageNum * limit;
      const to = from + limit - 1;

      console.log("Fetching messages for ticket:", {
        ticketId: ticket.id,
        from,
        to,
        pageNum
      });

      const { data, error } = await supabase
        .from('ticket_email_chats')
        .select('*')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.error("Error fetching ticket email thread:", error);
        return;
      }

      console.log("Fetched messages:", {
        count: data?.length || 0,
        messages: data,
        ticketId: ticket.id
      });

      if (pageNum === 0) {
        setMessages(data || []);
      } else {
        setMessages((prev) => [...prev, ...(data || [])]);
      }
      setHasMore(data && data.length === limit);
    } catch (error) {
      console.error("Error fetching ticket email thread:", error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (ticket?.id) {
      setPage(0)
      setMessages([])
      setHasMore(true)
      
      // First check if there are any emails for this ticket
      const checkEmails = async () => {
        const { count, error } = await supabase
          .from('ticket_email_chats')
          .select('*', { count: 'exact', head: true })
          .eq('ticket_id', ticket.id);
          
        console.log("Email count for ticket:", { ticketId: ticket.id, count, error });
      };
      
      checkEmails();
      fetchMessages(0)
    }
  }, [ticket?.id])

  useEffect(() => {
    if (inView && hasMore && !isLoading) {
      const nextPage = page + 1
      setPage(nextPage)
      fetchMessages(nextPage)
    }
  }, [inView, hasMore, isLoading])

  useEffect(() => {
    if (!ticket?.id) return;

    // Subscribe to new messages
    const channel = supabase
      .channel(`ticket-${ticket.id}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'ticket_email_chats',
          filter: `ticket_id=eq.${ticket.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            // Add new message to the list
            const newMessage = payload.new as EmailMessage;
            setMessages((prev) => {
              // Check if message already exists
              const exists = prev.some(msg => msg.id === newMessage.id);
              if (exists) return prev;
              
              // Add new message and sort by date
              const updated = [newMessage, ...prev];
              return updated.sort((a, b) => {
                const dateA = a.gmail_date ? new Date(a.gmail_date) : new Date(a.created_at);
                const dateB = b.gmail_date ? new Date(b.gmail_date) : new Date(b.created_at);
                return dateB.getTime() - dateA.getTime();
              });
            });
          } else if (payload.eventType === 'UPDATE') {
            // Update existing message
            const updatedMessage = payload.new as EmailMessage;
            setMessages((prev) => 
              prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg)
            );
          } else if (payload.eventType === 'DELETE') {
            // Remove deleted message
            const deletedMessage = payload.old as EmailMessage;
            setMessages((prev) => 
              prev.filter(msg => msg.id !== deletedMessage.id)
            );
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Subscribed to real-time updates for ticket ${ticket.id}`);
        }
      });

    return () => {
      console.log(`Unsubscribing from real-time updates for ticket ${ticket.id}`);
      supabase.removeChannel(channel);
    };
  }, [ticket?.id, supabase]);

  const handleSendMessage = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!replyText.trim() || sending || !ticket) return;
    
    try {
      setSending(true);
      
      // Get the latest message for threading info
      const latestMessage = messages[0];
      
      // Send email via API
      const response = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketId: ticket.id,
          threadId: ticket.thread_id || latestMessage?.thread_id,
          messageId: latestMessage?.message_id,
          inReplyTo: latestMessage?.message_id,
          references: latestMessage?.message_id,
          fromAddress: latestMessage?.to_address || "support@yourdomain.com",
          toAddresses: [latestMessage?.from_address || "recipient@example.com"],
          subject: latestMessage ? `Re: ${latestMessage.subject?.replace(/^Re:\s*/i, '')}` : "Re: Support Ticket",
          htmlBody: replyText,
          attachments: [],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send email');
      }

      const data = await response.json();

      // Add new message to the list
      setMessages((prev) => [data, ...prev]);
      
      // Clear the reply text
      setReplyText('');
    } catch (error) {
      console.error('Error sending reply:', error);
    } finally {
      setSending(false);
    }
  };

  function extractSenderName(subject: string | null, body: string | null): string | null {
    console.log('Extracting sender name from:', {
      subject,
      bodyLength: body?.length,
      bodyPreview: body?.substring(0, 200) // Show first 200 chars of body
    });
    
    if (!subject && !body) {
      console.log('No subject or body provided');
      return null;
    }
    
    // Try to extract from subject first
    if (subject) {
      console.log('Attempting to extract from subject:', subject);
      // Match patterns like "Name sent you" or "Name sent"
      const subjectMatch = subject.match(/^([^<]+?)\s+sent\s+(?:you\s+)?/i);
      if (subjectMatch) {
        console.log('Found name in subject:', subjectMatch[1].trim());
        return subjectMatch[1].trim();
      }
      console.log('No name pattern found in subject');
    }
    
    // If no name found in subject, try to find in body
    if (body) {
      console.log('Attempting to extract from body');
      const doc = new DOMParser().parseFromString(body, 'text/html');
      const titleElement = doc.querySelector('title');
      if (titleElement) {
        console.log('Found title element:', titleElement.textContent);
        const titleMatch = titleElement.textContent?.match(/^([^<]+?)\s+sent\s+(?:you\s+)?/i);
        if (titleMatch) {
          console.log('Found name in title:', titleMatch[1].trim());
          return titleMatch[1].trim();
        }
        console.log('No name pattern found in title');
      } else {
        console.log('No title element found in body');
      }
    }
    
    console.log('No sender name found in either subject or body');
    return null;
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-white text-slate-900 border-l border-slate-200">
        <SheetTitle className="sr-only">Email Thread</SheetTitle>
        <SheetDescription className="sr-only">Email conversation thread for ticket</SheetDescription>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-slate-600" />
              <h2 className="text-lg font-semibold text-slate-900">Email Thread</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-600 hover:text-slate-900">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            {isLoading && messages.length === 0 ? (
              // Loading skeleton
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ))
            ) : messages.length > 0 ? (
              messages.map((message, index) => (
                <div
                  key={message.id}
                  className="p-4 rounded-lg bg-slate-50 space-y-2"
                  ref={index === messages.length - 1 ? ref : undefined}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src={`https://www.gravatar.com/avatar/${md5(message.from_address.toLowerCase())}?d=mp`}
                          alt={message.from_name || message.from_address}
                        />
                        <AvatarFallback>
                          {(message.from_name || message.from_address).charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-slate-900">{message.from_name || message.from_address}</p>
                        <p className="text-sm text-slate-500">
                          {formatDistanceToNow(new Date(message.gmail_date || message.created_at), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </div>
                    {message.attachments?.length > 0 && (
                      <div className="flex items-center gap-1 text-sm text-slate-500">
                        <Paperclip className="h-4 w-4" />
                        <span>{message.attachments.length}</span>
                      </div>
                    )}
                  </div>
                  <div
                    className="prose max-w-none text-sm text-slate-700 whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{
                      __html: message.body,
                    }}
                  />
                </div>
              ))
            ) : (
              <div className="text-center text-slate-500">No messages found</div>
            )}
          </div>

          {/* Reply box */}
          <div className="pt-4 border-t border-slate-200">
            <div className="relative">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your reply..."
                className="w-full h-32 px-4 py-2 bg-slate-50 text-slate-900 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 border border-slate-200"
              />
              <div className="absolute bottom-2 right-2 flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-slate-400 hover:text-slate-600"
                >
                  <Smile className="h-4 w-4" />
                </Button>
                <Button
                  onClick={handleSendMessage}
                  disabled={!replyText.trim() || sending}
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span className="ml-2">Send</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
