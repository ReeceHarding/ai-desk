import CustomerHeader from '@/components/CustomerHeader';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle, RefreshCw, Send } from 'lucide-react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';

interface Ticket {
  id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  customer_id: string;
  org_id: string;
}

interface Comment {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  author: {
    display_name: string;
    avatar_url: string;
    role: string;
  };
  status?: 'sending' | 'sent' | 'error';
}

interface TicketComment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  author: {
    display_name: string;
    avatar_url: string;
    role: string;
  }[];
}

export default function CustomerTicketView() {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const { id } = router.query;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const commentEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) {
      fetchTicketData();
      subscribeToComments();
    }
  }, [id]);

  // Scroll to bottom when new comments arrive
  useEffect(() => {
    commentEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const fetchTicketData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Get ticket data
      const { data: ticketData, error: ticketError } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', id)
        .eq('customer_id', user.id)
        .single();

      if (ticketError) throw ticketError;
      if (!ticketData) throw new Error('Ticket not found');
      setTicket(ticketData);

      // Get comments
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select(`
          id,
          body,
          created_at,
          author_id,
          author:profiles!comments_author_id_fkey(display_name, avatar_url, role)
        `)
        .eq('ticket_id', id)
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;
      
      // Transform the data to match our Comment interface
      const transformedComments: Comment[] = (commentsData || []).map(comment => ({
        id: comment.id,
        body: comment.body,
        created_at: comment.created_at,
        author_id: comment.author_id,
        author: {
          display_name: comment.author[0].display_name,
          avatar_url: comment.author[0].avatar_url,
          role: comment.author[0].role
        }
      }));
      
      setComments(transformedComments);
    } catch (err: any) {
      console.error('Error fetching ticket data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToComments = () => {
    const channel = supabase
      .channel(`ticket-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `ticket_id=eq.${id}`
        },
        async (payload) => {
          console.log('New comment received:', payload);
          
          // Fetch just the new comment with author info
          const { data: newComment, error: commentError } = await supabase
            .from('comments')
            .select(`
              id,
              body,
              created_at,
              author_id,
              author:profiles!comments_author_id_fkey(display_name, avatar_url, role)
            `)
            .eq('id', payload.new.id)
            .single();

          if (commentError) {
            console.error('Error fetching new comment:', commentError);
            return;
          }

          // Transform the new comment to match our Comment interface
          const transformedNewComment: Comment = {
            id: newComment.id,
            body: newComment.body,
            created_at: newComment.created_at,
            author_id: newComment.author_id,
            author: {
              display_name: newComment.author[0].display_name,
              avatar_url: newComment.author[0].avatar_url,
              role: newComment.author[0].role
            }
          };

          // Add the new comment to the list
          setComments(prevComments => [...prevComments, transformedNewComment]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      setSubmitting(true);
      setCommentError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Get user's profile info
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('org_id, display_name, avatar_url, role')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;
      if (!profile?.org_id) throw new Error('No organization found for user');

      // Create optimistic comment
      const optimisticComment: Comment = {
        id: crypto.randomUUID(),
        body: newComment.trim(),
        created_at: new Date().toISOString(),
        author_id: user.id,
        author: {
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          role: profile.role
        },
        status: 'sending'
      };

      // Add optimistic comment
      setComments(prev => [...prev, optimisticComment]);
      setNewComment('');

      // Actually send the comment
      const { error: commentError } = await supabase
        .from('comments')
        .insert({
          ticket_id: id,
          author_id: user.id,
          body: newComment.trim(),
          org_id: profile.org_id,
          is_private: false
        });

      if (commentError) throw commentError;

      // Update optimistic comment to sent
      setComments(prev => 
        prev.map(comment => 
          comment.id === optimisticComment.id 
            ? { ...comment, status: 'sent' as const }
            : comment
        )
      );
    } catch (err: any) {
      console.error('Error submitting comment:', err);
      setCommentError(err.message);
      // Update optimistic comment to error
      setComments(prev => 
        prev.map(comment => 
          comment.status === 'sending'
            ? { ...comment, status: 'error' as const }
            : comment
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolveTicket = async () => {
    try {
      setSubmitting(true);
      const { error: updateError } = await supabase
        .from('tickets')
        .update({ status: 'solved' })
        .eq('id', id);

      if (updateError) throw updateError;
      
      // Refresh ticket data
      fetchTicketData();
    } catch (err: any) {
      console.error('Error resolving ticket:', err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
      case 'solved': return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
      case 'closed': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h3 className="mt-2 text-sm font-medium text-slate-900 dark:text-white">Ticket not found</h3>
          <div className="mt-6">
            <button
              onClick={() => router.push('/customer/tickets')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Return to tickets
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Head>
        <title>{ticket.subject} - Zendesk</title>
      </Head>

      <CustomerHeader title={ticket.subject} backUrl="/customer/tickets" />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {ticket.subject}
                </h1>
                <div className="mt-1 flex items-center">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(ticket.status)}`}>
                    {ticket.status}
                  </span>
                  <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">
                    Created on {new Date(ticket.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              {ticket.status !== 'solved' && ticket.status !== 'closed' && (
                <button
                  onClick={handleResolveTicket}
                  disabled={submitting}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark as Resolved
                </button>
              )}
            </div>

            <div className="mt-4 bg-white dark:bg-slate-800 shadow sm:rounded-lg p-6">
              <h2 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Description</h2>
              <p className="text-slate-500 dark:text-slate-400">{ticket.description}</p>
            </div>

            <div className="mt-8">
              <h2 className="text-lg font-medium text-slate-900 dark:text-white mb-4">Comments</h2>
              
              <div className="space-y-4 mb-6 max-h-[600px] overflow-y-auto">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex space-x-3">
                    <div className="flex-shrink-0">
                      <img
                        className="h-10 w-10 rounded-full"
                        src={comment.author.avatar_url || 'https://placehold.co/400x400/png?text=👤'}
                        alt={comment.author.display_name || 'User'}
                      />
                    </div>
                    <div className={`flex-1 bg-white dark:bg-slate-700/50 rounded-lg px-4 py-3 ${
                      comment.status === 'sending' ? 'opacity-70' : 
                      comment.status === 'error' ? 'border-red-500 border' : ''
                    }`}>
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-slate-900 dark:text-white">
                          {comment.author.display_name}
                          <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                            {comment.author.role}
                          </span>
                        </h3>
                        <div className="flex items-center">
                          {comment.status === 'sending' && (
                            <span className="text-xs text-slate-500 dark:text-slate-400 mr-2">
                              Sending...
                            </span>
                          )}
                          {comment.status === 'error' && (
                            <span className="text-xs text-red-500 mr-2">
                              Failed to send
                            </span>
                          )}
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {new Date(comment.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {comment.body}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={commentEndRef} />
              </div>

              {commentError && (
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/50 rounded-md">
                  <p className="text-sm text-red-600 dark:text-red-400">{commentError}</p>
                </div>
              )}

              {ticket.status !== 'closed' && (
                <form onSubmit={handleSubmitComment} className="mt-6">
                  <div>
                    <label htmlFor="comment" className="sr-only">Comment</label>
                    <div>
                      <textarea
                        id="comment"
                        name="comment"
                        rows={3}
                        className="shadow-sm block w-full focus:ring-blue-500 focus:border-blue-500 sm:text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        placeholder="Add a comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        disabled={submitting}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    {isTyping && (
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        Someone is typing...
                      </span>
                    )}
                    <div className="flex-shrink-0">
                      <button
                        type="submit"
                        disabled={submitting || !newComment.trim()}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {submitting ? 'Sending...' : 'Send'}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
} 
