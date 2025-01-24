import { Database } from '@/types/supabase';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

interface Props {
  invitation?: {
    id: string;
    organization_id: string;
    email: string;
    role: string;
    token: string;
    expires_at: string;
    organization: {
      name: string;
      slug: string;
    };
  };
  error?: string;
}

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const supabase = createServerSupabaseClient<Database>(context);
  const token = context.query.token as string;

  if (!token) {
    return {
      props: {
        error: 'Invalid invitation link'
      }
    };
  }

  // Get invitation details
  const { data: invitation, error: inviteError } = await supabase
    .from('invitations')
    .select(`
      id,
      organization_id,
      email,
      role,
      token,
      expires_at,
      organizations!inner (
        name,
        slug
      )
    `)
    .eq('token', token)
    .is('used_at', null)
    .single();

  if (inviteError || !invitation) {
    return {
      props: {
        error: 'Invalid or expired invitation'
      }
    };
  }

  // Check if invitation has expired
  if (new Date(invitation.expires_at) < new Date()) {
    return {
      props: {
        error: 'This invitation has expired'
      }
    };
  }

  // Transform the data to match our Props interface
  const formattedInvitation = {
    id: invitation.id,
    organization_id: invitation.organization_id,
    email: invitation.email,
    role: invitation.role,
    token: invitation.token,
    expires_at: invitation.expires_at,
    organization: {
      name: invitation.organizations[0].name,
      slug: invitation.organizations[0].slug,
    }
  };

  return {
    props: {
      invitation: formattedInvitation
    }
  };
};

export default function InvitePage({ invitation, error: serverError }: Props) {
  const router = useRouter();
  const supabase = useSupabaseClient<Database>();
  const user = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(serverError || null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (invitation) {
      setEmail(invitation.email);
    }
  }, [invitation]);

  const handleAcceptInvitation = async () => {
    if (!invitation) return;
    setIsLoading(true);
    setError(null);

    try {
      let userId = user?.id;

      // If user is not logged in, sign up
      if (!userId) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (authError) throw authError;
        userId = authData.user?.id;
      }

      if (!userId) throw new Error('Failed to create or get user');

      // Accept invitation using the function we created in the database
      const { error: acceptError } = await supabase.rpc('accept_invitation', {
        p_token: invitation.token,
        p_user_id: userId,
        p_organization_id: invitation.organization_id,
        p_role: invitation.role
      });

      if (acceptError) throw acceptError;

      // Redirect to the organization dashboard
      router.push(`/${invitation.organization.slug}/dashboard`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation');
    } finally {
      setIsLoading(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-red-600">Error</h2>
              <p className="mt-2 text-gray-600">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!invitation) return null;

  return (
    <>
      <Head>
        <title>Accept Invitation - {invitation.organization.name}</title>
      </Head>

      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Accept Invitation
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            You've been invited to join {invitation.organization.name} as an {invitation.role}
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            {user ? (
              // Already logged in user
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  You'll join as {user.email}
                </p>
                <button
                  onClick={handleAcceptInvitation}
                  disabled={isLoading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {isLoading ? 'Accepting...' : 'Accept Invitation'}
                </button>
              </div>
            ) : (
              // New user needs to sign up
              <div className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email address
                  </label>
                  <div className="mt-1">
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={email}
                      disabled
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <div className="mt-1">
                    <input
                      id="password"
                      name="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </div>
                </div>

                <button
                  onClick={handleAcceptInvitation}
                  disabled={isLoading || !password}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {isLoading ? 'Creating Account...' : 'Create Account & Accept'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
} 