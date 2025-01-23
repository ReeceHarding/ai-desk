import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { format } from 'date-fns'
import { AnimatePresence, motion } from "framer-motion"
import { Forward, Loader2, Mail, MoreHorizontal, Paperclip, Reply, Send, Star, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useInView } from 'react-intersection-observer'

interface EmailMessage {
  id: string
  from_address: string
  to_address: string[]
  subject: string
  body: string
  gmail_date: string
  attachments: Record<string, any>
}

interface EmailThreadPanelProps {
  isOpen: boolean
  onClose: () => void
  ticket: { id: string } | null
}

export function EmailThreadPanel({ isOpen, onClose, ticket }: EmailThreadPanelProps) {
  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState<EmailMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const { ref, inView } = useInView()
  const threadRef = useRef<HTMLDivElement>(null)

  const fetchMessages = async (pageNum: number) => {
    if (!ticket?.id || isLoading) return

    setIsLoading(true)
    try {
      console.log('Fetching messages for ticket:', ticket.id, 'page:', pageNum)
      const response = await fetch(`/api/gmail/ticket-thread?ticketId=${ticket.id}&page=${pageNum}`)
      const data = await response.json()
      console.log('Received data:', data)
      
      if (pageNum === 0) {
        setMessages(data.messages)
      } else {
        setMessages(prev => [...prev, ...data.messages])
      }
      
      setHasMore(data.hasMore)
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    console.log('EmailThreadPanel mounted/updated:', { isOpen, ticketId: ticket?.id })
    if (isOpen && ticket?.id) {
      setPage(0)
      fetchMessages(0)
    }
  }, [isOpen, ticket?.id])

  useEffect(() => {
    console.log('Current messages:', messages)
  }, [messages])

  useEffect(() => {
    if (inView && hasMore && !isLoading) {
      const nextPage = page + 1
      setPage(nextPage)
      fetchMessages(nextPage)
    }
  }, [inView, hasMore, isLoading])

  const groupMessagesByDate = (messages: EmailMessage[]) => {
    const groups: { [key: string]: EmailMessage[] } = {}
    messages.forEach(message => {
      const date = format(new Date(message.gmail_date), 'MMM d, yyyy')
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(message)
    })
    return groups
  }

  const messageGroups = groupMessagesByDate(messages)

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", bounce: 0, duration: 0.4 }}
          className="absolute top-0 right-8 w-[600px] h-full bg-slate-900 border-l border-slate-800 flex flex-col rounded-l-xl"
        >
          {/* Header */}
          <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                <Mail className="h-5 w-5 text-slate-300" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Email Thread</h2>
                <p className="text-sm text-slate-400">Ticket #{ticket?.id}</p>
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
          <div ref={threadRef} className="flex-1 overflow-auto p-4 space-y-4">
            {Object.entries(messageGroups).map(([date, groupMessages]) => (
              <div key={date}>
                <div className="flex justify-center mb-4">
                  <Badge variant="secondary" className="bg-slate-800 text-slate-300">
                    {date}
                  </Badge>
                </div>

                {groupMessages.map((email, index) => (
                  <div key={email.id} className="bg-slate-800/50 rounded-lg p-4 backdrop-blur-sm mb-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-slate-200 font-medium">{email.from_address}</p>
                        <p className="text-sm text-slate-400">
                          To: {email.to_address.join(', ')}
                        </p>
                      </div>
                      <span className="text-sm text-slate-400">
                        {format(new Date(email.gmail_date), 'h:mm a')}
                      </span>
                    </div>
                    <div className="prose prose-invert max-w-none">
                      <div 
                        dangerouslySetInnerHTML={{ __html: email.body }} 
                        className="text-slate-300"
                      />
                    </div>
                    {email.attachments && Object.keys(email.attachments).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-700">
                        <p className="text-sm text-slate-400 mb-2">Attachments:</p>
                        {Object.entries(email.attachments).map(([name, url]) => (
                          <a
                            key={name}
                            href={url as string}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 mr-4"
                          >
                            <Paperclip className="h-4 w-4" />
                            {name}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            )}

            {/* Infinite scroll trigger */}
            <div ref={ref} className="h-4" />
          </div>

          {/* Composer */}
          <div className="p-4 border-t border-slate-800 bg-slate-900/50 backdrop-blur-sm">
            <div className="relative">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Compose your email..."
                className="min-h-[100px] bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-400 resize-none pr-20"
              />
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                  <Paperclip className="h-5 w-5" />
                </Button>
                <Button size="icon" className="bg-blue-600 hover:bg-blue-700">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="mt-2 flex items-center text-xs text-slate-400">
              <span>Attachments will be supported in the next step</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
} 