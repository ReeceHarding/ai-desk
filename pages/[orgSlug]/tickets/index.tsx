import TicketPriorityBadge from '@/components/TicketPriorityBadge';
import TicketStatusBadge from '@/components/TicketStatusBadge';
import { Database, Json } from '@/types/supabase';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { GetServerSidePropsContext } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Organization = Database['public']['Tables']['organizations']['Row'] & {
  slug: string;
};

type TicketMetadata = {
  customer_side_solved?: boolean;
} & Json;

interface Ticket {
  id: string;
  subject: string;
  description: string;
  status: Database['public']['Enums']['ticket_status'];
  priority: Database['public']['Enums']['ticket_priority'];
  created_at: string;
  customer: Pick<Database['public']['Tables']['profiles']['Row'], 'display_name' | 'email'>;
  metadata: TicketMetadata;
}

interface Props {
  tickets: Ticket[];
  organization: Organization;
}

export const getServerSideProps = async (context: GetServerSidePropsContext) => {
  const supabase = createServerSupabaseClient<Database>(context);
  const orgSlug = context.params?.orgSlug as string;

  const { data: organization, error: orgError } = await supabase
    .from('organizations')
    .select('*, slug')
    .eq('slug', orgSlug)
    .single();

  if (orgError || !organization) {
    return {
      notFound: true,
    };
  }

  const { data: tickets, error: ticketsError } = await supabase
    .from('tickets')
    .select(`
      id,
      subject,
      description,
      status,
      priority,
      created_at,
      metadata,
      customer:profiles!inner(
        display_name,
        email
      )
    `)
    .eq('organization_id', organization.id)
    .order('created_at', { ascending: false });

  if (ticketsError) {
    return {
      notFound: true,
    };
  }

  type RawTicket = {
    id: string;
    subject: string;
    description: string;
    status: Database['public']['Enums']['ticket_status'];
    priority: Database['public']['Enums']['ticket_priority'];
    created_at: string;
    metadata: Json;
    customer: {
      display_name: string | null;
      email: string | null;
    };
  };

  const formattedTickets: Ticket[] = (tickets as unknown as RawTicket[]).map(ticket => ({
    id: ticket.id,
    subject: ticket.subject,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    created_at: ticket.created_at,
    metadata: ticket.metadata as TicketMetadata || { customer_side_solved: false },
    customer: {
      display_name: ticket.customer.display_name,
      email: ticket.customer.email
    }
  }));

  return {
    props: {
      tickets: formattedTickets,
      organization,
    },
  };
};

export default function TicketsList({ organization, tickets }: Props) {
  const [filter, setFilter] = useState<'all' | 'open' | 'solved'>('all');

  const filteredTickets = tickets.filter(ticket => {
    switch (filter) {
      case 'open':
        return ticket.status !== 'solved' && ticket.status !== 'closed';
      case 'solved':
        return ticket.status === 'solved' || ticket.status === 'closed';
      default:
        return true;
    }
  });

  return (
    <>
      <Head>
        <title>My Tickets - {organization.name}</title>
      </Head>

      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="md:flex md:items-center md:justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                My Support Tickets
              </h2>
            </div>
            <div className="mt-4 flex md:mt-0 md:ml-4">
              <Link
                href={`/${organization.slug}/new-ticket`}
                className="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                New Ticket
              </Link>
            </div>
          </div>

          <div className="mt-4">
            <div className="sm:hidden">
              <label htmlFor="filter" className="sr-only">
                Select a filter
              </label>
              <select
                id="filter"
                name="filter"
                className="block w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
                value={filter}
                onChange={(e) => setFilter(e.target.value as typeof filter)}
              >
                <option value="all">All Tickets</option>
                <option value="open">Open Tickets</option>
                <option value="solved">Solved Tickets</option>
              </select>
            </div>
            <div className="hidden sm:block">
              <nav className="flex space-x-4" aria-label="Tabs">
                {['all', 'open', 'solved'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setFilter(tab as typeof filter)}
                    className={`${
                      filter === tab
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'text-gray-500 hover:text-gray-700'
                    } px-3 py-2 font-medium text-sm rounded-md capitalize`}
                  >
                    {tab} Tickets
                  </button>
                ))}
              </nav>
            </div>
          </div>

          <div className="mt-8 flex flex-col">
            <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
              <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
                <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Subject
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Status
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Created
                        </th>
                        <th scope="col" className="relative px-6 py-3">
                          <span className="sr-only">View</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredTickets.map((ticket) => (
                        <tr key={ticket.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-3">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {ticket.subject}
                              </p>
                              <TicketStatusBadge
                                status={ticket.status}
                                customerSideSolved={
                                  typeof ticket.metadata === 'object' &&
                                  ticket.metadata !== null &&
                                  'customer_side_solved' in ticket.metadata
                                    ? ticket.metadata.customer_side_solved
                                    : false
                                }
                              />
                              <TicketPriorityBadge priority={ticket.priority} />
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {ticket.status}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(ticket.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Link
                              href={`/${organization.slug}/tickets/${ticket.id}`}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 