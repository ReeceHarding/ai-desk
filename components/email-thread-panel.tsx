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
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_email_chats',
          filter: `ticket_id=eq.${ticket.id}`,
        },
        (payload) => {
          // Add new message to the list
          const newMessage = payload.new as EmailMessage;
          setMessageList((prev) => [newMessage, ...prev]);
        }
      )
      .subscribe();

    return () => {
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
          className="absolute top-0 right-8 w-[600px] h-full bg-slate-900 border-l border-slate-800 flex flex-col rounded-l-xl shadow-2xl z-50"
        >
          {/* Header */}
          <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                <Mail className="h-5 w-5 text-slate-300" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Email Thread</h2>
                <p className="text-sm text-slate-400">Ticket #{ticket.id}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 pr-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                      <Reply className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reply</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                      <Forward className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Forward</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                      <Star className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Star email</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                      <MoreHorizontal className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>More options</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white" onClick={onClose}>
                      <X className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Close</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Email Thread */}
          <div className="flex-1 overflow-auto p-4 space-y-4 relative">
            {messageList.map((msg) => {
              const dateObj = msg.gmail_date ? new Date(msg.gmail_date) : new Date(msg.created_at)
              const dateLabel = format(dateObj, "MMM d, yyyy h:mm a")
              return (
                <div
                  key={msg.id}
                  className="bg-slate-800/50 rounded-lg p-4 backdrop-blur-sm mb-2"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-slate-200 font-medium">{msg.from_address || "Unknown"}</p>
                      <p className="text-sm text-slate-400">
                        To: {(msg.to_address || []).join(", ")}
                      </p>
                    </div>
                    <span className="text-sm text-slate-400">
                      {dateLabel}
                    </span>
                  </div>
                  <div
                    className="prose prose-invert max-w-none text-sm"
                    dangerouslySetInnerHTML={{ __html: msg.body || "" }}
                  />
                  {msg.attachments && Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-700">
                      <p className="text-sm text-slate-400 mb-2">Attachments:</p>
                      {(msg.attachments as Array<any>).map((att) => (
                        <a
                          key={att.name}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 mr-4"
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
          <div className="p-4 border-t border-slate-800 bg-slate-900/50 backdrop-blur-sm">
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