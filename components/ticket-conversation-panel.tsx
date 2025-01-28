import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileAttachment } from '@/components/ui/file-attachment';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { TypingIndicator } from '@/components/ui/typing-indicator';
import { useToast } from '@/components/ui/use-toast';
import { Database } from '@/types/supabase';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { formatDistanceToNow } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { Paperclip, Send } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

type Profile = {
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

type Organization = {
  name: string | null;
};

type Ticket = Database['public']['Tables']['tickets']['Row'] & {
  customer: Profile | null;
  organization: Organization | null;
};

type Comment = Database['public']['Tables']['comments']['Row'] & {
  author: Profile | null;
};

interface TicketConversationPanelProps {
  ticket: Ticket;
  isOpen: boolean;
}

interface FileAttachment {
  file: File;
  type: 'image' | 'document';
  previewUrl?: string;
}

export function TicketConversationPanel({
  ticket,
  isOpen,
}: TicketConversationPanelProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState<{ [key: string]: boolean }>({});
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const supabase = useSupabaseClient<Database>();
  const user = useUser();

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [comments]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!isOpen || !ticket) return;

    // Subscribe to comments channel
    const channel = supabase.channel(`comments-${ticket.id}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'comments',
          filter: `ticket_id=eq.${ticket.id}` 
        }, 
        async (payload) => {
          console.log('Real-time update received:', payload);

          if (payload.eventType === 'INSERT') {
            // Fetch the complete comment data with author information
            const { data: newComment, error } = await supabase
              .from('comments')
              .select(`
                *,
                author:profiles!comments_author_id_fkey (
                  display_name,
                  email,
                  avatar_url
                )
              `)
              .eq('id', payload.new.id)
              .single();

            if (!error && newComment) {
              setComments(prev => [...prev, newComment as Comment]);
            }
          } else if (payload.eventType === 'DELETE') {
            setComments(prev => prev.filter(comment => comment.id !== payload.old.id));
          }
        }
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const typing: { [key: string]: boolean } = {};
        
        Object.values(state).forEach(presence => {
          const presenceData = presence[0] as any;
          if (presenceData.isTyping) {
            typing[presenceData.user_id] = true;
          }
        });
        
        setTypingUsers(typing);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ 
            user_id: user?.id,
            isTyping: false 
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [isOpen, ticket, supabase, user]);

  // Fetch initial comments
  useEffect(() => {
    if (!isOpen || !ticket) return;

    async function fetchComments() {
      const { data: commentData, error: commentError } = await supabase
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
        .order('created_at', { ascending: true });

      if (commentError) {
        console.error('Error fetching comments:', commentError);
        return;
      }

      if (commentData) {
        const typedComments: Comment[] = commentData.map(comment => ({
          ...comment,
          author: comment.author as Profile,
        }));
        setComments(typedComments);
      }

      setLoading(false);
    }

    fetchComments();
  }, [isOpen, ticket, supabase]);

  // Handle typing status
  useEffect(() => {
    if (!isOpen || !ticket || !user) return;

    let typingTimeout: NodeJS.Timeout;
    const channel = supabase.channel(`comments-${ticket.id}`);

    const handleTyping = () => {
      channel.track({ 
        user_id: user.id,
        isTyping: true 
      });

      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        channel.track({ 
          user_id: user.id,
          isTyping: false 
        });
      }, 1000);
    };

    return () => {
      clearTimeout(typingTimeout);
      channel.track({ 
        user_id: user.id,
        isTyping: false 
      });
    };
  }, [isOpen, ticket, supabase, user]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newAttachments: FileAttachment[] = [];

    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: 'File too large',
          description: `${file.name} exceeds the 5MB limit`,
          variant: 'destructive',
        });
        continue;
      }

      const attachment: FileAttachment = {
        file,
        type: file.type.startsWith('image/') ? 'image' : 'document',
      };

      if (attachment.type === 'image') {
        attachment.previewUrl = URL.createObjectURL(file);
      }

      newAttachments.push(attachment);
    }

    setAttachments(prev => [...prev, ...newAttachments]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => {
      const newAttachments = [...prev];
      if (newAttachments[index].previewUrl) {
        URL.revokeObjectURL(newAttachments[index].previewUrl!);
      }
      newAttachments.splice(index, 1);
      return newAttachments;
    });
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || !user || (!newComment.trim() && attachments.length === 0)) return;

    setSubmitting(true);

    try {
      // Upload attachments to avatars bucket (since we can't modify schema)
      const uploadedFiles = [];
      for (const attachment of attachments) {
        const fileName = `${Date.now()}-${attachment.file.name}`;
        const { data, error: uploadError } = await supabase.storage
          .from('avatars') // Use existing avatars bucket
          .upload(`tickets/${ticket.id}/${fileName}`, attachment.file);

        if (uploadError) throw uploadError;
        uploadedFiles.push({
          path: data.path,
          type: attachment.type,
          name: attachment.file.name,
        });
      }

      // Create comment with exact schema fields
      const { data, error } = await supabase
        .from('comments')
        .insert([
          {
            ticket_id: ticket.id,
            author_id: user.id,
            body: newComment.trim() || 'Attached files', // Ensure body is never empty as per schema NOT NULL
            is_private: isPrivate,
            org_id: ticket.org_id,
            metadata: {
              attachments: uploadedFiles,
            },
            extra_json_1: {}, // Required by schema
          },
        ])
        .select(`
          id,
          ticket_id,
          author_id,
          body,
          is_private,
          metadata,
          org_id,
          created_at,
          author:profiles!comments_author_id_fkey (
            display_name,
            email,
            avatar_url
          )
        `)
        .single();

      if (error) throw error;

      if (data) {
        const authorData = Array.isArray(data.author) ? data.author[0] : data.author;
        const typedComment: Comment = {
          ...data,
          extra_text_1: null,
          extra_json_1: {},
          deleted_at: null,
          updated_at: data.created_at, // Since it's a new comment
          author: {
            display_name: authorData?.display_name || null,
            email: authorData?.email || null,
            avatar_url: authorData?.avatar_url || null,
          },
        };
        setComments([...comments, typedComment]);
        setNewComment('');
        setIsPrivate(false);
        setAttachments([]);
      }
    } catch (error) {
      console.error('Error creating comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-8 space-y-4"
    >
      <h3 className="text-lg font-semibold text-slate-100">Comments</h3>
      
      <div className="space-y-4 max-h-[600px] overflow-y-auto p-4">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            {comments.map((comment) => (
              <motion.div
                key={comment.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-lg ${
                  comment.is_private
                    ? 'bg-yellow-500/10 border border-yellow-500/20'
                    : 'bg-slate-800/50 border border-slate-700'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <Avatar className="h-8 w-8">
                    {comment.author?.avatar_url && (
                      <Image
                        src={comment.author.avatar_url}
                        alt={comment.author?.display_name || 'User'}
                        width={32}
                        height={32}
                      />
                    )}
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-slate-200">
                          {comment.author?.display_name || comment.author?.email || 'Unknown User'}
                        </span>
                        {comment.is_private && (
                          <Badge variant="secondary" className="text-xs">
                            Private
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-slate-500">
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-slate-300">{comment.body}</p>
                    
                    {/* Attachments */}
                    {comment.metadata && typeof comment.metadata === 'object' && 'attachments' in comment.metadata && Array.isArray(comment.metadata.attachments) && (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {comment.metadata.attachments.map((attachment: any, index: number) => (
                          <FileAttachment
                            key={index}
                            type={attachment.type}
                            name={attachment.name}
                            url={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${attachment.path}`}
                            previewMode
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
            
            {/* Typing Indicators */}
            <AnimatePresence>
              <TypingIndicator 
                count={Object.keys(typingUsers).length} 
                className="mt-2" 
              />
            </AnimatePresence>
            
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <form onSubmit={handleSubmitComment} className="space-y-4">
        {/* Attachment Preview */}
        {attachments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap gap-2 p-2 bg-slate-800/50 rounded-lg"
          >
            {attachments.map((attachment, index) => (
              <FileAttachment
                key={index}
                type={attachment.type}
                name={attachment.file.name}
                url={attachment.previewUrl || ''}
                onRemove={() => removeAttachment(index)}
              />
            ))}
          </motion.div>
        )}

        <div className="flex items-start space-x-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 min-h-[100px]"
          />
          <div className="space-y-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              multiple
              accept="image/*,.pdf,.doc,.docx,.txt"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button type="submit" size="icon" disabled={submitting}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="private"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            className="rounded border-slate-700"
          />
          <label htmlFor="private" className="text-sm text-slate-400">
            Make this comment private
          </label>
        </div>
      </form>
    </motion.div>
  );
} 