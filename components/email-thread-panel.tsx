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

interface EmailThreadPanelProps {
  isOpen: boolean
  onClose: () => void
  ticket: {
    id: string
    thread_id?: string | null
    message_id?: string | null
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
        .order('created_at', { ascending: false })
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
          className="absolute top-0 right-8 w-[600px] h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col rounded-l-xl shadow-2xl z-50"
        >
          {/* Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Email Thread</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Ticket #{ticket.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 pr-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                        <Reply className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reply</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                        <Forward className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Forward</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                        <Star className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Star email</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                        <MoreHorizontal className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>More options</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white" onClick={onClose}>
                        <X className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Close</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* First Message Preview */}
            {messageList.length > 0 && (
              <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-200">
                      {messageList[messageList.length - 1].from_name || messageList[messageList.length - 1].from_address}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {format(new Date(messageList[messageList.length - 1].created_at), "MMM d, yyyy h:mm a")}
                    </p>
                  </div>
                </div>
                <div className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">
                  {messageList[messageList.length - 1].subject && (
                    <span className="font-medium">{messageList[messageList.length - 1].subject} - </span>
                  )}
                  <span dangerouslySetInnerHTML={{ __html: messageList[messageList.length - 1].body.substring(0, 150) + '...' }} />
                </div>
              </div>
            )}
          </div>

          {/* Email Thread */}
          <div className="flex-1 overflow-auto p-4 space-y-4 relative">
            {messageList.map((msg) => {
              const dateObj = new Date(msg.created_at);
              const dateLabel = format(dateObj, "MMM d, yyyy h:mm a");
              return (
                <div
                  key={msg.id}
                  className="bg-slate-50/50 dark:bg-slate-800/50 rounded-lg p-4 backdrop-blur-sm mb-2"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-slate-900 dark:text-slate-200 font-medium">
                        {msg.from_name || msg.from_address}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        To: {(msg.to_address || []).join(", ")}
                      </p>
                      {msg.cc_address && msg.cc_address.length > 0 && (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          CC: {msg.cc_address.join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        {dateLabel}
                      </span>
                      {msg.ai_classification !== 'unknown' && (
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            msg.ai_classification === 'should_respond' 
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300'
                          }`}>
                            {msg.ai_classification === 'should_respond' ? 'Needs Response' : 'No Response Needed'}
                          </span>
                          {msg.ai_confidence > 0 && (
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {Math.round(msg.ai_confidence)}% confidence
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    className="prose prose-slate dark:prose-invert max-w-none text-sm"
                    dangerouslySetInnerHTML={{ __html: msg.body || "" }}
                  />
                  {msg.ai_draft_response && !msg.ai_auto_responded && (
                    <div className="mt-4 p-3 bg-slate-100 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-300">AI Draft Response</span>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                            onClick={() => handleSendMessage(msg.ai_draft_response!, [])}
                          >
                            Send
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                            onClick={() => {/* TODO: Implement edit draft */}}
                          >
                            Edit
                          </Button>
                        </div>
                      </div>
                      <div className="text-sm text-slate-700 dark:text-slate-300">{msg.ai_draft_response}</div>
                    </div>
                  )}
                  {msg.attachments && Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Attachments:</p>
                      {(msg.attachments as Array<any>).map((att) => (
                        <a
                          key={att.name}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 mr-4"
                        >
                          <Paperclip className="h-4 w-4" />
                          {att.name}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            )}

            {/* Intersection Observer sentinel */}
            <div ref={ref} className="h-4" />
          </div>

          {/* Composer */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
            <EmailComposer
              onSend={handleSendMessage}
              loading={false}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
} 