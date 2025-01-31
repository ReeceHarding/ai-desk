import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"
import { Database } from "@/types/supabase"
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react"
import { formatDistanceToNow } from "date-fns"
import { OAuth2Client } from "google-auth-library"
import { AlertCircle, CheckCircle, Clock, EyeOff, Inbox, Lock, Mail, Paperclip, RefreshCw, X } from "lucide-react"
import md5 from "md5"
import { useEffect, useRef, useState } from "react"
import { useInView } from "react-intersection-observer"
import { AIDraftPanel } from './ai-draft-panel'
import { EmailComposer } from './email-composer'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu"

type TicketStatus = 'open' | 'pending' | 'on_hold' | 'solved' | 'closed' | 'overdue';
type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

interface Message {
  id: string;
  body: string;
  from_name: string | null;
  from_address: string;
  created_at: string;
  message_type: 'email' | 'comment' | 'description';
  author?: {
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
  };
  thread_id?: string;
  message_id?: string;
  to_address?: string[];
  subject?: string | null;
  attachments?: any;
  ragResponse?: {
    chunks: {
      documentTitle: string;
      similarityScore: number;
      textPreview: string;
    }[];
    processingTimeMs: number;
  };
}

export interface EmailThreadPanelProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: {
    id: string;
    org_id: string;
    thread_id?: string | null;
    message_id?: string | null;
    subject?: string | null;
    support_email?: string;
    customer_email?: string;
  } | null;
}

const statusColors: Record<TicketStatus, string> = {
  open: 'bg-blue-500/10 text-blue-500',
  pending: 'bg-yellow-500/10 text-yellow-500',
  on_hold: 'bg-orange-500/10 text-orange-500',
  solved: 'bg-green-500/10 text-green-500',
  closed: 'bg-slate-500/10 text-slate-500',
  overdue: 'bg-red-500/10 text-red-500',
};

const priorityColors: Record<TicketPriority, string> = {
  low: 'bg-blue-500/10 text-blue-500',
  medium: 'bg-yellow-500/10 text-yellow-500',
  high: 'bg-orange-500/10 text-orange-500',
  urgent: 'bg-red-500/10 text-red-500',
};

const statusDescriptions: Record<TicketStatus, string> = {
  open: 'We are working on it',
  pending: 'We are waiting on something else',
  on_hold: 'The ticket is temporarily on hold',
  solved: 'Customer or agent marked as solved',
  closed: 'Fully closed - read-only',
  overdue: 'Past due date',
};

const StatusIcon = ({ status }: { status: TicketStatus }) => {
  const icons = {
    open: Inbox,
    pending: Clock,
    on_hold: EyeOff,
    solved: CheckCircle,
    closed: Lock,
    overdue: AlertCircle,
  };
  const Icon = icons[status] || AlertCircle;
  return <Icon className="h-4 w-4" />;
};

export function EmailThreadPanel({ isOpen, onClose, ticket }: EmailThreadPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const { ref, inView } = useInView()
  const supabase = useSupabaseClient<Database>()
  const user = useUser()
  const oauthClientRef = useRef<OAuth2Client | null>(null)
  const limit = 20
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [currentDraft, setCurrentDraft] = useState<Database['public']['Tables']['ticket_email_chats']['Row'] | null>(null)
  const [generatingRag, setGeneratingRag] = useState(false)
  const { toast } = useToast()
  const [ticketDetails, setTicketDetails] = useState<Database['public']['Tables']['tickets']['Row'] | null>(null);
  const [statusToChange, setStatusToChange] = useState<TicketStatus | null>(null);
  const [showStatusDialog, setShowStatusDialog] = useState(false);

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

      // Fetch ticket details first to get the description
      const { data: ticketData } = await supabase
        .from('tickets')
        .select(`
          *,
          customer:profiles!tickets_customer_id_fkey (
            display_name,
            email,
            avatar_url
          )
        `)
        .eq('id', ticket.id)
        .single();

      // Fetch email chats
      const { data: emailData } = await supabase
        .from('ticket_email_chats')
        .select('*')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      // Fetch comments
      const { data: commentData } = await supabase
        .from('comments')
        .select(`
          *,
          author:profiles!comments_author_id_fkey (
            display_name,
            email,
            avatar_url
          )
        `)
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: false });

      // Transform ticket description into a message
      const descriptionMessage: Message = {
        id: `${ticket.id}-description`,
        body: ticketData?.description || '',
        from_name: ticketData?.customer?.display_name || null,
        from_address: ticketData?.customer?.email || 'unknown@example.com',
        created_at: ticketData?.created_at || new Date().toISOString(),
        message_type: 'description',
        author: ticketData?.customer || undefined
      };

      // Transform email chats into messages
      const emailMessages: Message[] = (emailData || []).map(email => ({
        id: email.id,
        body: (email.body || '').replace(/\n{3,}/g, '\n\n'), // Ensure body is a string before replacing
        from_name: email.from_name,
        from_address: email.from_address || '',
        created_at: email.created_at,
        message_type: 'email',
        thread_id: email.thread_id,
        message_id: email.message_id,
        to_address: email.to_address,
        subject: email.subject,
        attachments: email.attachments
      }));

      // Transform comments into messages
      const commentMessages: Message[] = (commentData || []).map(comment => ({
        id: comment.id,
        body: (comment.body || '').replace(/\n{3,}/g, '\n\n'), // Ensure body is a string before replacing
        from_name: comment.author?.display_name || null,
        from_address: comment.author?.email || '',
        created_at: comment.created_at,
        message_type: 'comment',
        author: comment.author
      }));

      // Combine all messages and sort by date, removing duplicates by message_id
      const allMessages = [descriptionMessage, ...emailMessages, ...commentMessages]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .filter((message, index, self) => 
          // Keep only the first occurrence of each message_id
          index === self.findIndex((m) => 
            m.message_id && message.message_id && m.message_id === message.message_id
          )
        );

      if (pageNum === 0) {
        setMessages(allMessages);
      } else {
        setMessages(prev => [...prev, ...allMessages]);
      }
      setHasMore(Boolean(emailData && emailData.length === limit));

    } catch (error) {
      console.error("Error fetching messages:", error);
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
            const newMessage = payload.new as Message;
            setMessages((prev) => {
              // Check if message already exists
              const exists = prev.some(msg => msg.id === newMessage.id);
              if (exists) return prev;
              
              // Add new message and sort by date
              const updated = [newMessage, ...prev];
              return updated.sort((a, b) => {
                const dateA = a.created_at ? new Date(a.created_at) : new Date(a.created_at);
                const dateB = b.created_at ? new Date(b.created_at) : new Date(b.created_at);
                return dateB.getTime() - dateA.getTime();
              });
            });
          } else if (payload.eventType === 'UPDATE') {
            // Update existing message
            const updatedMessage = payload.new as Message;
            setMessages((prev) => 
              prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg)
            );
          } else if (payload.eventType === 'DELETE') {
            // Remove deleted message
            const deletedMessage = payload.old as Message;
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

  useEffect(() => {
    if (!ticket?.id) return;

    const fetchLatestDraft = async () => {
      const { data } = await supabase
        .from('ticket_email_chats')
        .select('*')
        .eq('ticket_id', ticket.id)
        .eq('ai_auto_responded', false)
        .not('ai_draft_response', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      setCurrentDraft(data || null);
    };

    fetchLatestDraft();
  }, [ticket?.id]);

  useEffect(() => {
    if (ticket?.id && isOpen) {
      const fetchTicketDetails = async () => {
        const { data } = await supabase
          .from('tickets')
          .select('*')
          .eq('id', ticket.id)
          .single();
        
        if (data) {
          setTicketDetails(data);
        }
      };
      
      fetchTicketDetails();
    }
  }, [ticket?.id, isOpen]);

  const handleSendMessage = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!replyText.trim() || sending || !ticket) {
      console.warn('Send message validation failed:', {
        hasReplyText: !!replyText.trim(),
        isSending: sending,
        hasTicket: !!ticket
      });
      return;
    }
    
    try {
      setSending(true);
      const currentText = replyText; // Store current text
      setReplyText(''); // Clear immediately for better UX
      
      // Get the latest message for threading info
      let latestMessage = messages[0];
      
      // If we don't have a thread_id from the latest message, fetch the latest email chat
      if (!latestMessage?.thread_id) {
        const { data: latestEmailChat } = await supabase
          .from('ticket_email_chats')
          .select('thread_id, message_id')
          .eq('ticket_id', ticket.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!latestEmailChat?.thread_id) {
          throw new Error('No existing email thread found for this ticket. Cannot reply.');
        }

        latestMessage = {
          ...latestMessage,
          thread_id: latestEmailChat.thread_id,
          message_id: latestEmailChat.message_id
        };
      }

      // Ensure we have a valid subject
      const subject = latestMessage?.subject 
        ? `Re: ${latestMessage.subject.replace(/^Re:\s*/i, '')}`
        : `Re: Support Ticket #${ticket.id}`;

      const emailPayload = {
        ticketId: ticket.id,
        threadId: latestMessage.thread_id,
        messageId: latestMessage.message_id,
        inReplyTo: latestMessage.message_id,
        references: latestMessage.message_id,
        fromAddress: Array.isArray(latestMessage?.to_address) 
          ? latestMessage.to_address[0] 
          : ticket.support_email || "support@yourdomain.com",
        toAddresses: [latestMessage?.from_address || ticket.customer_email || "unknown@example.com"],
        subject,
        htmlBody: replyText,
        attachments: [],
        orgId: ticket.org_id
      } as const;

      // Validate required fields
      const requiredFields = ['ticketId', 'threadId', 'fromAddress', 'toAddresses', 'subject', 'htmlBody', 'orgId'] as const;
      const missingFields = requiredFields.filter(field => !emailPayload[field as keyof typeof emailPayload]);
      
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      // Create optimistic message
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        body: replyText,
        from_name: user?.email?.split('@')[0] || 'Support Agent',
        from_address: emailPayload.fromAddress,
        created_at: new Date().toISOString(),
        message_type: 'email',
        thread_id: emailPayload.threadId,
        message_id: `temp-${Date.now()}`,
        to_address: [...emailPayload.toAddresses],
        subject: emailPayload.subject,
      };

      // Add optimistic message to the list
      setMessages(prev => [optimisticMessage, ...prev]);

      console.log('Sending email with payload:', {
        ...emailPayload,
        hasBody: !!emailPayload.htmlBody,
      });
      
      // Send email via API
      const response = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailPayload),
      });

      if (!response.ok) {
        // Restore the text if sending failed
        setReplyText(currentText);
        // Remove optimistic message on error
        setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
        
        const errorData = await response.json();
        console.error('Failed to send email:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData.error,
          details: errorData.details
        });
        throw new Error(errorData.error || 'Failed to send email');
      }

      const data = await response.json();
      console.log('Email sent successfully:', {
        messageId: data.message_id,
        threadId: data.thread_id
      });

      // Replace optimistic message with real message
      setMessages(prev => prev.map(msg => 
        msg.id === optimisticMessage.id 
          ? {
              ...msg,
              id: data.messageId,
              message_id: data.messageId,
              thread_id: data.threadId,
            }
          : msg
      ));
      
      // Show success toast
      toast({
        title: "Email Sent",
        description: "Your reply has been sent successfully.",
      });
    } catch (error: any) {
      console.error('Error sending reply:', {
        error: error.message,
        stack: error.stack,
        name: error.name
      });
      
      toast({
        title: "Failed to Send Email",
        description: error.message || "An error occurred while sending your reply.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleGenerateRagResponse = async () => {
    if (!ticket?.org_id || generatingRag) return;

    try {
      setGeneratingRag(true);
      
      // Get the latest message for context
      const latestMessage = messages[0];
      if (!latestMessage) {
        toast({
          title: "No message found",
          description: "Cannot generate response without a message to respond to.",
          variant: "destructive",
        });
        return;
      }

      // Get previous messages for context (excluding the latest one)
      const previousMessages = messages
        .slice(1, 6) // Get up to 5 previous messages for context
        .map(msg => ({
          body: msg.body,
          from: msg.from_name || msg.from_address,
          type: msg.message_type,
          created_at: msg.created_at
        }));

      console.log('Generating RAG response with context:', {
        latestMessagePreview: latestMessage.body.substring(0, 200) + '...',
        previousMessagesCount: previousMessages.length,
        ticketId: ticket.id,
        orgId: ticket.org_id
      });

      // Get current user's display name
      const { data: profileData } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user?.id)
        .single();

      // Call our RAG API endpoint
      const response = await fetch('/api/rag/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailText: latestMessage.body,
          orgId: ticket.org_id,
          messageHistory: previousMessages,
          senderInfo: {
            fromName: latestMessage.from_name || latestMessage.from_address?.split('@')[0],
            agentName: profileData?.display_name || user?.email?.split('@')[0]
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate RAG response');
      }

      const data = await response.json();
      
      console.log('Received RAG response:', {
        confidenceScore: data.confidence,
        responsePreview: data.response.substring(0, 200) + '...',
        referencesCount: data.references.length,
        debug: data.debug
      });
      
      // Clear existing text first
      setReplyText('');
      // Use setTimeout to ensure the clear happens first
      setTimeout(() => {
        setReplyText(data.response);
      }, 0);

      // Show debug information in a dialog
      if (data.debug) {
        const debugContent = (
          <div className="space-y-2">
            <div>
              <strong>Knowledge Base Chunks Used:</strong>
              {data.debug.chunks?.map((chunk: any, idx: number) => (
                <div key={idx} className="mt-2 space-y-1">
                  <div><strong>Document:</strong> {chunk.docTitle || chunk.docId}</div>
                  <div><strong>Similarity Score:</strong> {(chunk.similarity * 100).toFixed(1)}%</div>
                  <div><strong>Text Preview:</strong> {chunk.text.substring(0, 100)}...</div>
                </div>
              ))}
            </div>
            <div>
              <strong>Processing Time:</strong> {data.debug.processingTimeMs}ms
            </div>
          </div>
        );

        toast({
          title: "RAG Response Details",
          description: debugContent,
        });
      }
    } catch (error) {
      console.error('Error generating RAG response:', error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate response. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGeneratingRag(false);
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

  const handleDraftSent = () => {
    setCurrentDraft(null);
    fetchMessages(0);
  };

  const handleDraftDiscarded = () => {
    setCurrentDraft(null);
  };

  const handleRagResponse = async (message: Message) => {
    if (!message.ragResponse) return;

    const debugContent = (
      <div className="space-y-2">
        <div>
          <strong>Knowledge Base Chunks Used:</strong>
          {message.ragResponse.chunks.map((chunk, i) => (
            <div key={i} className="mt-2 space-y-1">
              <div><strong>Document:</strong> {chunk.documentTitle}</div>
              <div><strong>Similarity Score:</strong> {chunk.similarityScore}</div>
              <div><strong>Text Preview:</strong> {chunk.textPreview}</div>
            </div>
          ))}
        </div>
        <div>
          <strong>Processing Time:</strong> {message.ragResponse.processingTimeMs}ms
        </div>
      </div>
    );

    toast({
      title: "RAG Response Details",
      description: debugContent,
    });
  };

  const handleSend = () => {
    handleSendMessage(new MouseEvent('click') as any);
  };

  const handleRefresh = async () => {
    if (!ticket?.id) return;
    setIsLoading(true);
    try {
      await fetchMessages(0);
      toast({
        title: "Refreshed",
        description: "Email thread has been updated.",
      });
    } catch (error) {
      console.error('Error refreshing messages:', error);
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh email thread. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (status: TicketStatus) => {
    if (!ticket?.id) return;
    
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ status })
        .eq('id', ticket.id);

      if (error) throw error;

      setTicketDetails(prev => prev ? { ...prev, status } : null);
      
      toast({
        title: 'Status updated',
        description: `Ticket status changed to ${status}`,
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: 'Error updating status',
        description: error instanceof Error ? error.message : 'Failed to update status',
        variant: 'destructive',
      });
    }
  };

  const handlePriorityChange = async (priority: TicketPriority) => {
    if (!ticket?.id) return;
    
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ priority })
        .eq('id', ticket.id);

      if (error) throw error;

      setTicketDetails(prev => prev ? { ...prev, priority } : null);
      
      toast({
        title: 'Priority updated',
        description: `Ticket priority changed to ${priority}`,
      });
    } catch (error) {
      console.error('Error updating priority:', error);
      toast({
        title: 'Error updating priority',
        description: error instanceof Error ? error.message : 'Failed to update priority',
        variant: 'destructive',
      });
    }
  };

  const handleStatusSelect = (status: TicketStatus) => {
    if (status === 'solved' || status === 'closed') {
      setStatusToChange(status);
      setShowStatusDialog(true);
    } else {
      handleStatusChange(status);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-white text-slate-900 border-l border-slate-200">
        <SheetTitle className="sr-only">Email Thread</SheetTitle>
        <SheetDescription className="sr-only">Email conversation thread for ticket</SheetDescription>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="space-y-4 pb-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-slate-600" />
                <h2 className="text-lg font-semibold text-slate-900">Email Thread</h2>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className="gap-2 text-slate-600 hover:text-slate-900"
                >
                  <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
                <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-600 hover:text-slate-900">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {ticketDetails && (
              <div className="flex flex-col gap-2">
                {/* Quick Status Controls */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-slate-600">Quick Status Update</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleStatusSelect('open')}
                      className={cn("justify-start hover:bg-slate-100 transition-colors", ticketDetails.status === 'open' ? statusColors.open : '')}
                    >
                      <Inbox className="h-4 w-4 mr-2" />
                      Open
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleStatusSelect('pending')}
                      className={cn("justify-start hover:bg-slate-100 transition-colors", ticketDetails.status === 'pending' ? statusColors.pending : '')}
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      Pending
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleStatusSelect('solved')}
                      className={cn("justify-start hover:bg-slate-100 transition-colors", ticketDetails.status === 'solved' ? statusColors.solved : '')}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Solved
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleStatusSelect('closed')}
                      className={cn("justify-start hover:bg-slate-100 transition-colors", ticketDetails.status === 'closed' ? statusColors.closed : '')}
                    >
                      <Lock className="h-4 w-4 mr-2" />
                      Closed
                    </Button>
                  </div>
                </div>

                {/* Priority Control */}
                <div>
                  <h3 className="text-sm font-medium text-slate-600 mb-2">Priority</h3>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className={`w-full justify-start hover:bg-slate-100 transition-colors ${priorityColors[ticketDetails.priority]}`}
                      >
                        <AlertCircle className="h-4 w-4" />
                        <span className="ml-2 uppercase">{ticketDetails.priority}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {Object.keys(priorityColors).map((priority) => (
                        <DropdownMenuItem
                          key={priority}
                          onClick={() => handlePriorityChange(priority as TicketPriority)}
                          className={`${priorityColors[priority as TicketPriority]} hover:bg-slate-100`}
                        >
                          <AlertCircle className="h-4 w-4" />
                          <span className="ml-2 uppercase">{priority}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )}
          </div>

          {/* Status Change Dialog */}
          <AlertDialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {statusToChange === 'solved' ? 'Mark Ticket as Solved?' : 'Close Ticket?'}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {statusToChange === 'solved' 
                    ? 'This will mark the ticket as solved. The customer can still reopen it if they need further assistance.'
                    : 'This will close the ticket permanently. No further comments can be added after closing.'}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (statusToChange) {
                      handleStatusChange(statusToChange);
                    }
                    setShowStatusDialog(false);
                  }}
                  className={statusToChange === 'solved' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'}
                >
                  {statusToChange === 'solved' ? 'Mark as Solved' : 'Close Ticket'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            {/* Show AI draft at the top if available */}
            {currentDraft && (
              <AIDraftPanel
                ticketEmailChat={currentDraft}
                onDraftSent={handleDraftSent}
                onDraftDiscarded={handleDraftDiscarded}
              />
            )}

            {isLoading && messages.length === 0 ? (
              // Loading skeleton
              Array.from({ length: 3 }).map((_, i) => (
                <div key={`skeleton-${i}`} className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ))
            ) : messages.length > 0 ? (
              messages.map((message) => (
                <div
                  key={`message-${message.id}`}
                  className="p-4 rounded-lg bg-slate-50 space-y-2"
                  ref={message === messages[messages.length - 1] ? ref : undefined}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src={message.author?.avatar_url || (message.from_address ? `https://www.gravatar.com/avatar/${md5(message.from_address.toLowerCase())}?d=mp` : 'https://www.gravatar.com/avatar/default?d=mp')}
                          alt={message.from_name || message.from_address || 'Unknown Sender'}
                        />
                        <AvatarFallback>
                          {(message.from_name || message.from_address || 'U').charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-slate-900">
                          {message.from_name || message.from_address}
                          {message.message_type === 'description' && ' (Initial Message)'}
                        </p>
                        <p className="text-sm text-slate-500">
                          {(() => {
                            try {
                              const date = new Date(message.created_at);
                              // Check if date is valid
                              if (isNaN(date.getTime())) {
                                console.warn('Invalid date value:', message.created_at);
                                return 'Date unavailable';
                              }
                              return formatDistanceToNow(date, {
                                addSuffix: true,
                              });
                            } catch (error) {
                              console.error('Error formatting date:', error);
                              return 'Date unavailable';
                            }
                          })()}
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
                    className="prose max-w-none text-sm text-slate-700 break-words"
                    style={{ whiteSpace: 'pre-line' }}
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
            <EmailComposer
              value={replyText}
              onChange={setReplyText}
              onSend={handleSend}
              onGenerateAIResponse={handleGenerateRagResponse}
              isSending={sending}
              isGeneratingAI={generatingRag}
              placeholder="Type your reply..."
              className="border-none bg-slate-50"
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
