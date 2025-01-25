import { logger } from '@/utils/logger';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/router';
import { useState } from 'react';

export default function ConnectGmail() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  const handleConnectGmail = async () => {
    setIsLoading(true);
    setError(null);

    try {
      logger.info('[CONNECT_GMAIL] Starting Gmail OAuth');

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        logger.error('[CONNECT_GMAIL] Auth error:', { error: userError });
        setError('Could not verify your identity');
        return;
      }

      const response = await fetch('/api/gmail/onboarding-auth-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'agent',
          id: user.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get auth URL');
      }

      logger.info('[CONNECT_GMAIL] OAuth initiated successfully');
      window.location.href = data.url;
    } catch (err) {
      logger.error('[CONNECT_GMAIL] Unexpected error:', { error: err });
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    setIsLoading(true);
    setError(null);

    try {
      logger.info('[CONNECT_GMAIL] User skipping Gmail setup');

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        logger.error('[CONNECT_GMAIL] Auth error:', { error: userError });
        setError('Could not verify your identity');
        return;
      }

      // Update profile to mark Gmail setup as skipped
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          metadata: {
            gmail_setup_skipped: true,
            gmail_setup_skipped_at: new Date().toISOString()
          }
        })
        .eq('id', user.id);

      if (updateError) {
        logger.error('[CONNECT_GMAIL] Profile update error:', { error: updateError });
        setError('Failed to update your preferences');
        return;
      }

      logger.info('[CONNECT_GMAIL] Gmail setup skipped successfully');
      router.push('/tickets');
    } catch (err) {
      logger.error('[CONNECT_GMAIL] Unexpected error:', { error: err });
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Connect Gmail
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Connect your Gmail account to manage tickets via email
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900">Why connect Gmail?</h3>
              <div className="mt-2 text-sm text-gray-500">
                <ul className="list-disc pl-5 space-y-1">
                  <li>Respond to tickets directly from your email</li>
                  <li>Automatically create tickets from incoming emails</li>
                  <li>Keep your email and ticket workflows in sync</li>
                </ul>
              </div>
            </div>

            <div className="flex flex-col space-y-4">
              <button
                onClick={handleConnectGmail}
                disabled={isLoading}
                className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isLoading ? (
                  'Connecting...'
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M20 18h-2V9.25L12 13 6 9.25V18H4V6h1.2l6.8 4.25L18.8 6H20m0-2H4c-1.11 0-2 .89-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.11-.9-2-2-2z"
                      />
                    </svg>
                    Connect Gmail
                  </>
                )}
              </button>

              <button
                onClick={handleSkip}
                disabled={isLoading}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Skip for now (you can connect later)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 