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

  const supabase = useSupabaseClient<Database>();
  const user = useUser();

  // Fetch comments when the panel opens
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
      <h3 className="text-lg font-semibold text-gray-900">Comments</h3>
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          comments.map((comment) => (
            <motion.div
              key={comment.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start gap-4">
                <Avatar className="ring-2 ring-gray-100">
                  <Image
                    src={comment.author?.avatar_url || '/default-avatar.png'}
                    alt={comment.author?.display_name || 'User'}
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-medium text-gray-900">
                        {comment.author?.display_name || 'Unknown User'}
                      </span>
                      <span className="text-sm text-gray-500 ml-2">
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    {comment.is_private && (
                      <Badge variant="outline">
                        Private
                      </Badge>
                    )}
                  </div>
                  <p className="text-gray-600 leading-relaxed">{comment.body}</p>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Comment form */}
      <form onSubmit={handleSubmitComment} className="space-y-4">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write a comment..."
          className="min-h-[100px] resize-none"
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button type="button" variant="ghost" size="icon" className="text-gray-500 hover:text-gray-900">
              <Paperclip className="h-4 w-4" />
            </Button>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600 hover:text-gray-900">Make private</span>
            </label>
          </div>
          <Button
            type="submit"
            disabled={!newComment.trim() || submitting}
            className="inline-flex items-center gap-2"
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
    </motion.div>
  );
} 