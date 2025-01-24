import CommentForm from '@/components/CommentForm';
import CommentList from '@/components/CommentList';
import TicketPriorityBadge from '@/components/TicketPriorityBadge';
import TicketStatusBadge from '@/components/TicketStatusBadge';
import { Database } from '@/types/supabase';
import { createClient } from '@supabase/supabase-js';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState } from 'react';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Comment {
  id: string;
  content: string;
  created_at: string;
  author: {
    display_name: string;
    role: string;
  };
}

interface Ticket {
  id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  customer: {
    display_name: string;
    email: string;
  };
  comments: Comment[];
  metadata: {
    customer_side_solved?: boolean;
  };
}

interface Props {
  ticket: Ticket;
  organization: {
    name: string;
    slug: string;
  };
}

export const getServerSideProps: GetServerSideProps<Props> = async ({ params }) => {
  const orgSlug = params?.orgSlug;
  const ticketId = params?.ticketId;

  if (!orgSlug || !ticketId || typeof orgSlug !== 'string' || typeof ticketId !== 'string') {
    return {
      notFound: true
    };
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('name, slug')
    .eq('slug', orgSlug)
    .single();

  if (!org) {
    return {
      notFound: true
    };
  }

  const { data: ticketData } = await supabase
    .from('tickets')
    .select(`
      id,
      subject,
      description,
      status,
      priority,
      created_at,
      metadata,
      customer:profiles!tickets_customer_id_fkey (
        display_name,
        email
      ),
      comments (
        id,
        content,
        created_at,
        author:profiles!comments_author_id_fkey (
          display_name,
          role
        )
      )
    `)
    .eq('id', ticketId)
    .single();

  if (!ticketData) {
    return {
      notFound: true
    };
  }

  // Transform the data to match our interfaces
  const ticket: Ticket = {
    id: ticketData.id,
    subject: ticketData.subject,
    description: ticketData.description,
    status: ticketData.status,
    priority: ticketData.priority,
    created_at: ticketData.created_at,
    metadata: ticketData.metadata || {},
    customer: {
      display_name: ticketData.customer[0]?.display_name || '',
      email: ticketData.customer[0]?.email || ''
    },
    comments: ticketData.comments.map(comment => ({
      id: comment.id,
      content: comment.content,
      created_at: comment.created_at,
      author: {
        display_name: comment.author[0]?.display_name || '',
        role: comment.author[0]?.role || ''
      }
    }))
  };

  return {
    props: {
      ticket,
      organization: org
    }
  };
};

export default function TicketView({ ticket, organization }: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [customerSideSolved, setCustomerSideSolved] = useState(ticket.metadata?.customer_side_solved || false);

  const handleSubmitComment = async (content: string) => {
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/${organization.slug}/tickets/${ticket.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error('Failed to add comment');
      }

      router.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkSolved = async () => {
    try {
      const response = await fetch(`/api/${organization.slug}/tickets/${ticket.id}/solved`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          solved: !customerSideSolved
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update ticket status');
      }

      setCustomerSideSolved(!customerSideSolved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  };

  return (
    <>
      <Head>
        <title>Ticket #{ticket.id.slice(0, 8)} - {organization.name}</title>
      </Head>

      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h1 className="text-lg leading-6 font-medium text-gray-900">
                {ticket.subject}
              </h1>
              
              <div className="mt-2 max-w-xl text-sm text-gray-500">
                <div className="flex items-center space-x-4">
                  <TicketStatusBadge
                    status={ticket.status}
                    customerSideSolved={ticket.metadata?.customer_side_solved}
                  />
                  <TicketPriorityBadge priority={ticket.priority} />
                  <p>Created: {new Date(ticket.created_at).toLocaleString()}</p>
                  <p>By: {ticket.customer.display_name || ticket.customer.email}</p>
                </div>
              </div>

              <div className="mt-5 border-t border-gray-200 pt-5">
                <div className="prose max-w-none">
                  {ticket.description}
                </div>
              </div>

              <div className="mt-6">
                <button
                  onClick={handleMarkSolved}
                  className={`inline-flex items-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium ${
                    customerSideSolved
                      ? 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                      : 'border-transparent text-white bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {customerSideSolved ? 'Mark as Unsolved' : 'Mark as Solved'}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-lg font-medium text-gray-900">Comments</h2>

            <div className="mt-4">
              <CommentList comments={ticket.comments} />
              <CommentForm
                onSubmit={handleSubmitComment}
                isSubmitting={isSubmitting}
                error={error}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 