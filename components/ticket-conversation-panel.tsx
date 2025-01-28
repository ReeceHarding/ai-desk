import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Database } from '@/types/supabase';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { Paperclip, Send } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';

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

  const supabase = useSupabaseClient<Database>();
  const user = useUser();

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

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || !user || !newComment.trim()) return;

    setSubmitting(true);

    try {
      const { data, error } = await supabase
        .from('comments')
        .insert([
          {
            ticket_id: ticket.id,
            author_id: user.id,
            body: newComment,
            is_private: isPrivate,
            org_id: ticket.org_id,
          },
        ])
        .select(`
          *,
          author:profiles!comments_author_id_fkey (
            display_name,
            email,
            avatar_url
          )
        `)
        .single();

      if (error) throw error;

      if (data) {
        const typedComment: Comment = {
          ...data,
          author: data.author as Profile,
        };
        setComments([...comments, typedComment]);
        setNewComment('');
        setIsPrivate(false);
      }
    } catch (error) {
      console.error('Error creating comment:', error);
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
      <div className="space-y-4">
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
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 hover:bg-slate-800/70 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <Avatar className="ring-2 ring-slate-700/50">
                    <Image
                      src={comment.author?.avatar_url || 'https://placehold.co/400x400/png?text=👤'}
                      alt={comment.author?.display_name || 'User'}
                      width={40}
                      height={40}
                      className="rounded-full"
                    />
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-medium text-slate-100">
                          {comment.author?.display_name || 'Unknown User'}
                        </span>
                        <span className="text-sm text-slate-400 ml-2">
                          {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      {comment.is_private && (
                        <Badge variant="outline" className="text-slate-300 border-slate-600 bg-slate-700/50">
                          Private
                        </Badge>
                      )}
                    </div>
                    <p className="text-slate-300 leading-relaxed">{comment.body}</p>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Typing indicators */}
            {Object.keys(typingUsers).length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-slate-400 italic"
              >
                {Object.keys(typingUsers).map(userId => (
                  <div key={userId} className="flex items-center gap-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span>Someone is typing...</span>
                  </div>
                ))}
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* Comment form */}
      {ticket.status === 'closed' ? (
        <div className="text-sm text-slate-400 italic p-4 bg-slate-800/50 rounded-lg">
          This ticket is closed. No further comments can be added.
        </div>
      ) : ticket.status === 'solved' ? (
        <div className="text-sm text-slate-400 italic p-4 bg-slate-800/50 rounded-lg">
          This ticket is marked as solved. Please reopen it if you need further assistance.
        </div>
      ) : (
        <form onSubmit={handleSubmitComment} className="space-y-4">
          <Textarea
            value={newComment}
            onChange={(e) => {
              setNewComment(e.target.value);
              const channel = supabase.channel(`comments-${ticket.id}`);
              channel.track({ 
                user_id: user?.id,
                isTyping: true 
              });
            }}
            placeholder="Write a comment..."
            className="min-h-[100px] bg-slate-800/50 border-slate-700 focus:border-slate-500 focus:ring-slate-500 placeholder:text-slate-500"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button type="button" variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-700/50">
                <Paperclip className="h-4 w-4" />
              </Button>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="form-checkbox bg-slate-800 border-slate-700 text-indigo-500 focus:ring-indigo-500"
                />
                <span className="text-sm text-slate-400 hover:text-slate-300">Make private</span>
              </label>
            </div>
            <Button
              type="submit"
              disabled={!newComment.trim() || submitting}
              className="inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-700 disabled:text-slate-400"
            >
              {submitting ? (
                <Skeleton className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send
            </Button>
          </div>
        </form>
      )}
    </motion.div>
  );
} 