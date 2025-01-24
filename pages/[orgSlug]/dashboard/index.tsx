import { Database } from '@/types/supabase';
import { createClientComponentClient, createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

type Ticket = Database['public']['Tables']['tickets']['Row'];
type Organization = Database['public']['Tables']['organizations']['Row'];

interface Props {
  organization: Pick<Organization, 'id' | 'name'>;
  userRole: string;
}

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const supabase = createPagesServerClient<Database>(context);
  const { orgSlug } = context.params || {};

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return {
      redirect: {
        destination: '/auth/signin',
        permanent: false,
      },
    };
  }

  // Get organization details
  const { data: organization } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('slug', orgSlug)
    .single();

  if (!organization) {
    return {
      notFound: true,
    };
  }

  // Get user's role in this organization
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', organization.id)
    .eq('user_id', session.user.id)
    .single();

  // If not a member or customer, show 403
  if (!membership) {
    return {
      redirect: {
        destination: '/403',
        permanent: false,
      },
    };
  }

  // If customer, redirect to their tickets page
  if (membership.role === 'customer') {
    return {
      redirect: {
        destination: '/tickets',
        permanent: false,
      },
    };
  }

  return {
    props: {
      organization: {
        id: organization.id,
        name: organization.name,
      },
      userRole: membership.role,
    },
  };
};

export default function OrganizationDashboard({ organization, userRole }: Props) {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTickets = async () => {
      const supabase = createClientComponentClient<Database>();
      const { data } = await supabase
        .from('tickets')
        .select()
        .eq('org_id', organization.id)
        .order('created_at', { ascending: false });

      if (data) {
        setTickets(data);
      }
      setLoading(false);
    };

    fetchTickets();
  }, [organization.id]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">{organization.name} Dashboard</h1>
        {userRole === 'admin' && (
          <button
            onClick={() => router.push(`/${router.query.orgSlug}/dashboard/admin`)}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Admin Settings
          </button>
        )}
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Tickets</h2>
        <div className="space-y-4">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="border p-4 rounded hover:bg-gray-50 cursor-pointer"
              onClick={() => router.push(`/tickets/${ticket.id}`)}
            >
              <div className="flex justify-between">
                <h3 className="font-medium">{ticket.subject}</h3>
                <span className={`px-2 py-1 rounded text-sm ${
                  ticket.status === 'open' ? 'bg-green-100 text-green-800' :
                  ticket.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {ticket.status}
                </span>
              </div>
              <p className="text-gray-600 text-sm mt-1">{ticket.description}</p>
              <div className="flex justify-between items-center mt-2 text-sm text-gray-500">
                <span>Created {new Date(ticket.created_at).toLocaleDateString()}</span>
                <span>#{ticket.id.split('-')[0]}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 