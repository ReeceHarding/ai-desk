import { Database } from '@/types/supabase';
import { logger } from '@/utils/logger';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

// Gmail scopes - safe to have on client since they're public
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.metadata'
];

export default function ConnectGmailAdmin() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState<string>('');
  const supabase = createClientComponentClient<Database>();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    // Check for success/error query params
    if (router.query.success) {
      // Import emails after successful connection
      const importEmails = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            logger.error('[GMAIL_CONNECT] No user found');
            return;
          }

          // Get user's organization
          const { data: profile } = await supabase
            .from('profiles')
            .select('org_id')
            .eq('id', user.id)
            .single();

          if (!profile?.org_id) {
            logger.error('[GMAIL_CONNECT] No organization found');
            return;
          }

          // Import emails via API call
          const response = await fetch('/api/gmail/import-emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ organizationId: profile.org_id })
          });

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to import emails');
          }

          // Redirect to tickets page
          router.push('/tickets');
        } catch (err) {
          logger.error('[GMAIL_CONNECT] Error importing emails:', { error: err });
          setError('Failed to import emails. Please try again later.');
        }
      };

      importEmails();
      router.replace('/onboarding/admin/connect-gmail', undefined, { shallow: true });
    } else if (router.query.error) {
      setError('Failed to connect Gmail account. Please try again.');
      router.replace('/onboarding/admin/connect-gmail', undefined, { shallow: true });
    }
  }, [router.query, supabase, router]);

  const handleConnectGmail = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Could not verify your identity');
      }

      // Initiate OAuth flow
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/api/integrations/gmail/callback`,
          scopes: GMAIL_SCOPES.join(' '),
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
            state: `onboarding:admin:${user.id}`
          }
        }
      });

      if (error) throw error;
      if (!data?.url) throw new Error('No OAuth URL received');

      // Redirect to Google OAuth
      window.location.href = data.url;
    } catch (err) {
      logger.error('[GMAIL_CONNECT] Error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    router.push('/tickets');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Connect Gmail Account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Connect your Gmail account to import and manage your emails
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded relative" role="alert">
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          <div className="space-y-6">
            <button
              type="button"
              onClick={handleConnectGmail}
              disabled={isLoading}
              className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                isLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isLoading ? 'Connecting...' : 'Connect Gmail'}
            </button>

            <button
              type="button"
              onClick={handleSkip}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 