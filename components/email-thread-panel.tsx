import { Database } from '@/types/supabase'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { Download, Paperclip, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { EmailComposer } from './EmailComposer'
import { Button } from './ui/button'

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

interface EmailMessage {
  id: string
  from_address: string
  to_address: string[]
  subject: string
  body: string
  thread_id?: string | null
  message_id?: string | null
  attachments: Array<{
    name: string
    url: string
    size: number
    type: string
  }>
  created_at: string
}

export function EmailThreadPanel({ isOpen, onClose, ticket }: EmailThreadPanelProps) {
  const [messageList, setMessageList] = useState<EmailMessage[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = useSupabaseClient<Database>()

  useEffect(() => {
    if (ticket?.id) {
      fetchMessages()
    }
  }, [ticket?.id])

  const fetchMessages = async () => {
    if (!ticket) return

    const { data: messages, error } = await supabase
      .from('ticket_email_chats')
      .select(`
        id,
        from_address,
        to_address,
        subject,
        body,
        attachments,
        created_at
      `)
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching messages:', error)
      toast.error('Failed to load messages.')
      return
    }

    setMessageList(messages || [])
  }

  const handleSendMessage = async (body: string, attachments: any[]) => {
    if (!ticket) return
    setLoading(true)
    try {
      // Get the latest message for threading info
      const latestMessage = messageList[0]
      
      // If this is a website-originated ticket (no thread_id), store directly in database
      if (!ticket.thread_id && !latestMessage?.thread_id) {
        const { data: newMessage, error } = await supabase
          .from('ticket_email_chats')
          .insert({
            ticket_id: ticket.id,
            from_address: latestMessage?.to_address?.[0] || "support@yourdomain.com",
            to_address: [latestMessage?.from_address || ticket.customer?.email],
            subject: latestMessage ? `Re: ${latestMessage.subject?.replace(/^Re:\s*/i, '')}` : "Re: Support Ticket",
            body,
            attachments,
            org_id: ticket.org_id
          })
          .select()
          .single()

        if (error) {
          console.error('Error sending message:', error)
          toast.error('Failed to send message.')
          return
        }
        
        // Add new message to the list
        if (newMessage) {
          setMessageList((prev) => [newMessage, ...prev])
          toast.success('Message sent successfully.')
        }
        return
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
          htmlBody: body,
          attachments,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send email')
      }

      await fetchMessages()
      toast.success('Email sent successfully.')
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Failed to send message.')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-lg flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">Email Thread</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messageList.map((message) => (
          <div
            key={message.id}
            className="bg-gray-50 rounded-lg p-4 space-y-2"
          >
            <div className="flex justify-between text-sm text-gray-600">
              <div>
                <div>From: {message.from_address}</div>
                <div>To: {message.to_address.join(', ')}</div>
              </div>
              <div>{formatDate(message.created_at)}</div>
            </div>
            
            <div className="text-sm font-medium">{message.subject}</div>
            <div className="text-sm" dangerouslySetInnerHTML={{ __html: message.body }} />

            {message.attachments && message.attachments.length > 0 && (
              <div className="mt-2 space-y-2">
                <div className="text-sm font-medium">Attachments:</div>
                <div className="space-y-1">
                  {message.attachments.map((attachment, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-white rounded-md text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Paperclip className="h-4 w-4 text-gray-500" />
                        <div>
                          <div className="font-medium">{attachment.name}</div>
                          <div className="text-xs text-gray-500">
                            {formatFileSize(attachment.size)}
                          </div>
                        </div>
                      </div>
                      <a
                        href={attachment.url}
                        download={attachment.name}
                        className="p-1 hover:bg-gray-100 rounded-full"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Download className="h-4 w-4 text-gray-500" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t">
        <EmailComposer onSend={handleSendMessage} loading={loading} />
      </div>
    </div>
  )
} 