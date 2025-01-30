import { AppLayout } from '@/components/layout/AppLayout';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { AlertCircle, RefreshCw, Send } from 'lucide-react';
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
  customer: {
    display_name: string;
    email: string;
    avatar_url: string;
  };
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

export default function AgentTicketView() {
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

      // Get ticket data with customer info
      const { data: ticketData, error: ticketError } = await supabase
        .from('tickets')
        .select(`
          *,
          customer:profiles!tickets_customer_id_fkey(
            display_name,
            email,
            avatar_url
          )
        `)
        .eq('id', id)
        .single();

      if (ticketError) throw ticketError;
      if (!ticketData) throw new Error('Ticket not found');
      
      // Transform the data to match our Ticket type
      const transformedTicket: Ticket = {
        ...ticketData,
        customer: Array.isArray(ticketData.customer) ? ticketData.customer[0] : ticketData.customer
      };
      
      setTicket(transformedTicket);

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
      
      // Transform comments to match our Comment type
      const transformedComments: Comment[] = (commentsData || []).map(comment => ({
        ...comment,
        author: Array.isArray(comment.author) ? comment.author[0] : comment.author
      }));
      
      setComments(transformedComments);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch ticket data');
    } finally {
      setLoading(false);
    }
  };

  const subscribeToComments = () => {
    const subscription = supabase
      .channel(`ticket-${id}-comments`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `ticket_id=eq.${id}`,
        },
        async (payload: any) => {
          if (payload.eventType === 'INSERT') {
            const { data: newComment, error } = await supabase
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

            if (!error && newComment) {
              // Transform the new comment to match our Comment type
              const transformedComment: Comment = {
                ...newComment,
                author: Array.isArray(newComment.author) ? newComment.author[0] : newComment.author
              };
              setComments(prev => [...prev, transformedComment]);
            }
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
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

      const { error: commentError } = await supabase
        .from('comments')
        .insert({
          ticket_id: id,
          body: newComment,
          author_id: user.id,
        });

      if (commentError) throw commentError;
      setNewComment('');
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Failed to submit comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateTicketStatus = async (newStatus: string) => {
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      setTicket(prev => prev ? { ...prev, status: newStatus } : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update ticket status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'solved':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-slate-700 rounded w-1/4 mb-4"></div>
          <div className="h-32 bg-gray-200 dark:bg-slate-700 rounded w-full mb-4"></div>
          <div className="h-16 bg-gray-200 dark:bg-slate-700 rounded w-3/4"></div>
        </div>
      </AppLayout>
    );
  }

  if (error || !ticket) {
    return (
      <AppLayout>
        <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 dark:text-red-500 mr-2" />
            <p className="text-red-800 dark:text-red-200">{error || 'Ticket not found'}</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Head>
        <title>{ticket.subject} - Agent View</title>
      </Head>

      <div className="space-y-6">
        {/* Ticket Header */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-start mb-4">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{ticket.subject}</h1>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(ticket.status)}`}>
              {ticket.status}
            </span>
          </div>

          <div className="flex items-center space-x-4 mb-4">
            <img
              src={ticket.customer.avatar_url || 'https://placehold.co/400x400/png?text=👤'}
              alt={ticket.customer.display_name || 'Customer'}
              className="w-10 h-10 rounded-full"
            />
            <div>
              <p className="font-medium text-slate-900 dark:text-white">{ticket.customer.display_name || 'Unknown Customer'}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{ticket.customer.email}</p>
            </div>
          </div>

          <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap mb-4">{ticket.description}</p>

          <div className="flex space-x-2">
            <button
              onClick={() => handleUpdateTicketStatus('open')}
              className="px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/50 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/70"
            >
              Open
            </button>
            <button
              onClick={() => handleUpdateTicketStatus('pending')}
              className="px-4 py-2 text-sm font-medium text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/50 rounded-md hover:bg-yellow-100 dark:hover:bg-yellow-900/70"
            >
              Pending
            </button>
            <button
              onClick={() => handleUpdateTicketStatus('solved')}
              className="px-4 py-2 text-sm font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/50 rounded-md hover:bg-green-100 dark:hover:bg-green-900/70"
            >
              Solved
            </button>
          </div>
        </div>

        {/* Comments Section */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Comments</h2>
            
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {comments.map((comment) => (
                <div key={comment.id} className="flex space-x-3">
                  <div className="flex-shrink-0">
                    <img
                      className="h-10 w-10 rounded-full"
                      src={comment.author.avatar_url || 'https://placehold.co/400x400/png?text=👤'}
                      alt={comment.author.display_name || 'User'}
                    />
                  </div>
                  <div className={`flex-1 bg-slate-50 dark:bg-slate-700/50 rounded-lg px-4 py-3 ${
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
                    <p className="mt-1 text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{comment.body}</p>
                  </div>
                </div>
              ))}
              <div ref={commentEndRef} />
            </div>
          </div>

          {/* Comment Form */}
          <form onSubmit={handleSubmitComment} className="border-t border-slate-200 dark:border-slate-700 p-6">
            {commentError && (
              <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/50 text-red-800 dark:text-red-200 rounded-md">
                {commentError}
              </div>
            )}
            <div className="flex items-start space-x-4">
              <div className="min-w-0 flex-1">
                <textarea
                  rows={3}
                  name="comment"
                  id="comment"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="block w-full rounded-md border-0 py-1.5 text-slate-900 dark:text-white shadow-sm ring-1 ring-inset ring-slate-300 dark:ring-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 bg-white dark:bg-slate-800"
                  placeholder="Add your comment..."
                />
              </div>
              <button
                type="submit"
                disabled={submitting || !newComment.trim()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
} 
