import { EmailComposer } from "@/components/EmailComposer"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Database } from "@/types/supabase"
import { useSupabaseClient } from "@supabase/auth-helpers-react"
import { format } from "date-fns"
import { AnimatePresence, motion } from "framer-motion"
import { Forward, Loader2, Mail, MoreHorizontal, Paperclip, Reply, Star, X } from "lucide-react"
import { useEffect, useState } from "react"
import { useInView } from "react-intersection-observer"

interface EmailMessage {
  id: string
  ticket_id: string
  message_id: string | null
  thread_id: string | null
  from_address: string | null
  to_address: string[] | null
  cc_address: string[] | null
  bcc_address: string[] | null
  subject: string | null
  body: string | null
  attachments: any
  sent_at: string | null
  org_id: string
  created_at: string
  updated_at: string
}

interface EmailThreadPanelProps {
  isOpen: boolean
  onClose: () => void
  ticket: {
    id: string
    thread_id?: string | null
    message_id?: string | null
    subject?: string | null
    description?: string | null
    customer?: {
      display_name: string | null
      email: string | null
    } | null
    created_at?: string | null
    org_id: string
  } | null
}

export function EmailThreadPanel({ isOpen, onClose, ticket }: EmailThreadPanelProps) {
  const [messageList, setMessageList] = useState<EmailMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const { ref, inView } = useInView()
  const supabase = useSupabaseClient<Database>()

  const fetchMessages = async (pageNum: number) => {
    if (!ticket?.id || isLoading) return
    setIsLoading(true)
    try {
      const limit = 20
      const from = pageNum * limit
      const to = from + limit - 1

      const { data, error } = await supabase
        .from('ticket_email_chats')
        .select('*')
        .eq('ticket_id', ticket.id)
        .order('sent_at', { ascending: false })
        .range(from, to)

      if (error) throw error

      if (pageNum === 0) {
        setMessageList(data)
      } else {
        setMessageList((prev) => [...prev, ...data])
      }
      setHasMore(data.length === limit)
    } catch (error) {
      console.error("Error fetching ticket email thread:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && ticket?.id) {
      setPage(0)
      setMessageList([])
      setHasMore(true)
      fetchMessages(0)
    }
  }, [isOpen, ticket?.id])

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
            setMessageList((prev) => {
              // Check if message already exists
              const exists = prev.some(msg => msg.id === newMessage.id);
              if (exists) return prev;
              
              // Add new message and sort by date
              const updated = [newMessage, ...prev];
              return updated.sort((a, b) => {
                const dateA = a.sent_at ? new Date(a.sent_at) : new Date(a.created_at);
                const dateB = b.sent_at ? new Date(b.sent_at) : new Date(b.created_at);
                return dateB.getTime() - dateA.getTime();
              });
            });
          } else if (payload.eventType === 'UPDATE') {
            // Update existing message
            const updatedMessage = payload.new as EmailMessage;
            setMessageList((prev) => 
              prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg)
            );
          } else if (payload.eventType === 'DELETE') {
            // Remove deleted message
            const deletedMessage = payload.old as EmailMessage;
            setMessageList((prev) => 
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

  const handleSendMessage = async (htmlBody: string, attachments: any[]) => {
    if (!ticket) return;
    try {
      // Get the latest message for threading info
      const latestMessage = messageList[0];
      
      // If this is a website-originated ticket (no thread_id), store directly in database
      if (!ticket.thread_id && !latestMessage?.thread_id) {
        const { data: newMessage, error } = await supabase
          .from('ticket_email_chats')
          .insert({
            ticket_id: ticket.id,
            from_address: latestMessage?.to_address?.[0] || "support@yourdomain.com",
            to_address: [latestMessage?.from_address || ticket.customer?.email],
            subject: latestMessage ? `Re: ${latestMessage.subject?.replace(/^Re:\s*/i, '')}` : "Re: Support Ticket",
            body: htmlBody,
            attachments: attachments,
            org_id: ticket.org_id
          })
          .select()
          .single();

        if (error) throw error;
        
        // Add new message to the list
        if (newMessage) {
          setMessageList((prev) => [newMessage, ...prev]);
        }
        return;
      }

      // Otherwise, send via Gmail API
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
          fromAddress: latestMessage?.to_address?.[0] || "support@yourdomain.com",
          toAddresses: [latestMessage?.from_address || ticket.customer?.email],
          subject: latestMessage ? `Re: ${latestMessage.subject?.replace(/^Re:\s*/i, '')}` : "Re: Support Ticket",
          htmlBody,
          attachments,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send email');
      }

      const data = await response.json();

      // Add new message to the list
      setMessageList((prev) => [data, ...prev]);
    } catch (error) {
      console.error("Send message error:", error);
      throw error; // Re-throw to be handled by the UI
    }
  };

  return (
    <AnimatePresence>
      {isOpen && ticket?.id && (
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", bounce: 0, duration: 0.4 }}
          className="fixed inset-0 sm:absolute sm:inset-auto sm:top-0 sm:right-8 w-full sm:w-[600px] h-full bg-white border-l border-gray-200 flex flex-col sm:rounded-l-xl shadow-lg z-50"
        >
          {/* Header */}
          <div className="p-3 sm:p-4 border-b border-gray-200 bg-white/50 backdrop-blur-sm flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-50 flex items-center justify-center">
                <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">Email Thread</h2>
                <p className="text-xs sm:text-sm text-gray-500">Ticket #{ticket.id}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 pr-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-gray-600 hover:text-gray-900"
                    >
                      <Star className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Star thread</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-gray-600 hover:text-gray-900"
                    >
                      <Forward className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Forward thread</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-gray-600 hover:text-gray-900"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>More options</TooltipContent>
                </Tooltip>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipProvider>
            </div>
          </div>

          {/* Message List */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
            {/* Initial Ticket Description */}
            {ticket?.description && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-gray-900">
                    {ticket.customer?.display_name || 'Customer'}
                  </span>
                  <span className="text-sm text-gray-500">
                    {ticket.created_at && format(new Date(ticket.created_at), 'MMM d, yyyy h:mm a')}
                  </span>
                </div>
                <div className="text-gray-700">
                  <div className="font-medium mb-1">{ticket.subject || 'Support Ticket'}</div>
                  <div className="whitespace-pre-wrap">{ticket.description}</div>
                </div>
              </div>
            )}
            
            {messageList.map((message, index) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex flex-col gap-2 sm:gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                        <div className="font-medium text-gray-900 text-sm sm:text-base truncate">
                          {message.from_address}
                        </div>
                        <div className="text-xs sm:text-sm text-gray-500">
                          {message.sent_at
                            ? format(new Date(message.sent_at), 'PPp')
                            : format(new Date(message.created_at), 'PPp')}
                        </div>
                      </div>
                      <div className="text-xs sm:text-sm text-gray-500 truncate">
                        To: {message.to_address?.join(', ')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-600 hover:text-gray-900"
                      >
                        <Reply className="h-4 w-4" />
                      </Button>
                      {message.attachments && message.attachments.length > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-gray-600 hover:text-gray-900"
                        >
                          <Paperclip className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="text-sm sm:text-base text-gray-600 break-words">
                    {message.body}
                  </div>
                </div>
              </motion.div>
            ))}
            
            {/* Load more trigger */}
            {hasMore && (
              <div ref={ref} className="flex justify-center p-4">
                {isLoading && <Loader2 className="h-6 w-6 animate-spin text-gray-400" />}
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-gray-200 p-3 sm:p-4">
            <EmailComposer onSend={handleSendMessage} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 