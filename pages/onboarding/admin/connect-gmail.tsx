import { Database } from '@/types/supabase';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Loader2, Mail } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function ConnectGmailPage() {
  const router = useRouter();
  const supabase = createClientComponentClient<Database>();
  const [error, setError] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);
  const [orgDetails, setOrgDetails] = useState<{id: string, name: string, slug: string}|null>(null);

  useEffect(() => {
    console.log('[CONNECT-GMAIL] Component mounted');
    const fetchOrgDetails = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        console.error('[CONNECT-GMAIL] No user session found');
        router.push('/auth/signin');
        return;
      }

      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id, name, slug')
        .eq('owner_id', session.user.id)
        .single();

      if (orgError) {
        console.error('[CONNECT-GMAIL] Error fetching organization:', orgError);
        setError('Failed to load organization details');
        return;
      }

      if (!org) {
        console.error('[CONNECT-GMAIL] No organization found');
        router.push('/onboarding/admin/create-org');
        return;
      }

      console.log('[CONNECT-GMAIL] Organization loaded:', {
        id: org.id,
        name: org.name,
        slug: org.slug
      });
      setOrgDetails(org);
    };

    fetchOrgDetails();
  }, [router, supabase]);

  const handleConnectGmail = async () => {
    console.log('[CONNECT-GMAIL] Starting Gmail connection');
    if (!orgDetails) {
      console.error('[CONNECT-GMAIL] No organization details available');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Store org ID in localStorage for retrieval after OAuth
      console.log('[CONNECT-GMAIL] Storing organization data in localStorage');
      localStorage.setItem('pendingOrgId', orgDetails.id);
      localStorage.setItem('pendingOrgName', orgDetails.name);
      localStorage.setItem('pendingOrgCreatedAt', new Date().toISOString());

      // Initiate Google OAuth flow
      console.log('[CONNECT-GMAIL] Initiating Google OAuth flow');
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?orgId=${orgDetails.id}`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
            scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify'
          }
        }
      });

      if (signInError) {
        console.error('[CONNECT-GMAIL] OAuth initialization failed:', signInError);
        throw signInError;
      }

      console.log('[CONNECT-GMAIL] OAuth flow initiated successfully');
      // The redirect will happen automatically
    } catch (err: any) {
      console.error('[CONNECT-GMAIL] Error connecting Gmail:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    if (!orgDetails?.slug) return;
    console.log('[CONNECT-GMAIL] Skipping Gmail setup');
    router.push(`/${orgDetails.slug}/dashboard`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Connect Gmail
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Connect your Gmail account to enable email support
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="rounded-md bg-red-50 p-4 mb-6">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    {error}
                  </h3>
                </div>
              </div>
            </div>
          )}

          {orgDetails && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  {orgDetails.name}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Connect Gmail to start managing support emails
                </p>
              </div>

              <div className="space-y-4">
                <button
                  onClick={handleConnectGmail}
                  disabled={loading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Connect Gmail
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSkip}
                  className="w-full text-sm text-gray-500 hover:text-gray-700"
                >
                  Skip Gmail setup (you can connect later)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 