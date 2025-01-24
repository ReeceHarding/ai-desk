import { EmailComposer } from "@/components/EmailComposer"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Database } from "@/types/supabase"
import { useSupabaseClient } from "@supabase/auth-helpers-react"
import { format } from "date-fns"
import { AnimatePresence, motion } from "framer-motion"
import { OAuth2Client } from "google-auth-library"
import { Forward, Loader2, Mail, MoreHorizontal, Paperclip, Reply, Star, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
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
  gmail_date: string | null
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
  } | null
}

export function EmailThreadPanel({ isOpen, onClose, ticket }: EmailThreadPanelProps) {
  const [messageList, setMessageList] = useState<EmailMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const { ref, inView } = useInView()
  const supabase = useSupabaseClient<Database>()
  const oauthClientRef = useRef<OAuth2Client | null>(null)

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
        .order('gmail_date', { ascending: false })
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
                const dateA = a.gmail_date ? new Date(a.gmail_date) : new Date(a.created_at);
                const dateB = b.gmail_date ? new Date(b.gmail_date) : new Date(b.created_at);
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
          fromAddress: latestMessage?.to_address?.[0] || "support@yourdomain.com",
          toAddresses: [latestMessage?.from_address || "recipient@example.com"],
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
          className="absolute top-0 right-8 w-[600px] h-full bg-white border-l border-gray-200 flex flex-col rounded-l-xl shadow-lg z-50"
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-200 bg-white/50 backdrop-blur-sm flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Email Thread</h2>
                <p className="text-sm text-gray-500">Ticket #{ticket.id}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 pr-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-900 hover:bg-gray-100">
                      <Reply className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reply</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-900 hover:bg-gray-100">
                      <Forward className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Forward</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-900 hover:bg-gray-100">
                      <Star className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Star email</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-900 hover:bg-gray-100">
                      <MoreHorizontal className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>More options</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-900 hover:bg-gray-100" onClick={onClose}>
                      <X className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Close panel</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Message List */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Initial Ticket Description */}
            {ticket.description && (
              <div className="mb-6 bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      {ticket.customer?.display_name ? (
                        <span className="text-blue-600 font-medium">
                          {ticket.customer.display_name[0].toUpperCase()}
                        </span>
                      ) : (
                        <span className="text-blue-600 font-medium">U</span>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">
                        {ticket.customer?.display_name || ticket.customer?.email || 'Unknown User'}
                      </p>
                      {ticket.created_at && (
                        <time className="text-xs text-gray-500">
                          {format(new Date(ticket.created_at), 'MMM d, yyyy h:mm a')}
                        </time>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">Initial Request</p>
                  </div>
                </div>
                <div className="pl-[52px]">
                  <h3 className="text-base font-medium text-gray-900 mb-2">
                    {ticket.subject}
                  </h3>
                  <div className="prose prose-sm max-w-none text-gray-600">
                    {ticket.description}
                  </div>
                </div>
              </div>
            )}

            {/* Email Messages */}
            <div className="space-y-6">
              {messageList.map((message) => (
                <div key={message.id} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{message.from_address}</p>
                      <div className="text-sm text-gray-500 space-x-2">
                        <span>To: {message.to_address?.join(", ")}</span>
                        {message.cc_address && message.cc_address.length > 0 && (
                          <span>CC: {message.cc_address.join(", ")}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {message.gmail_date && format(new Date(message.gmail_date), "MMM d, yyyy h:mm a")}
                    </div>
                  </div>
                  <div className="text-gray-700" dangerouslySetInnerHTML={{ __html: message.body || "" }} />
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="border-t border-gray-200 pt-3 mt-3">
                      <div className="text-sm font-medium text-gray-900 mb-2">Attachments</div>
                      <div className="flex flex-wrap gap-2">
                        {message.attachments.map((attachment: any, i: number) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg text-sm text-gray-700"
                          >
                            <Paperclip className="h-4 w-4 text-gray-500" />
                            <span>{attachment.filename}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Load More Trigger */}
            {hasMore && (
              <div ref={ref} className="py-4 flex justify-center">
                {isLoading && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading more messages...
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-gray-200 p-4">
            <EmailComposer onSend={handleSendMessage} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
} 