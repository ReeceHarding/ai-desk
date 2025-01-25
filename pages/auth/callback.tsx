import { logger } from '@/utils/logger';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function Callback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check for OAuth errors first
        if (router.query.error) {
          const errorMsg = router.query.error_description || router.query.error;
          logger.error('OAuth Error:', { error: errorMsg });
          router.push(`/auth/error?error=${encodeURIComponent(errorMsg as string)}`);
          return;
        }

        // Get the code verifier from localStorage
        const codeVerifierKey = `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]}-auth-token-code-verifier`;
        const codeVerifier = localStorage.getItem(codeVerifierKey);

        if (!codeVerifier) {
          logger.error('No code verifier found in localStorage');
          router.push('/auth/error?error=No code verifier found. Please try signing in again.');
          return;
        }

        if (!router.query.code) {
          logger.error('No auth code found in URL');
          router.push('/auth/error?error=No authorization code found');
          return;
        }

        // Exchange code for session
        const { data, error } = await supabase.auth.exchangeCodeForSession(router.asPath);

        if (error) {
          logger.error('Error exchanging code for session:', error);
          router.push(`/auth/error?error=${encodeURIComponent(error.message)}`);
          return;
        }

        // Clear code verifier
        localStorage.removeItem(codeVerifierKey);

        // Get redirect URL from query params or use default
        const redirectTo = router.query.next as string || '/dashboard';
        router.push(redirectTo);
      } catch (err) {
        logger.error('Unexpected error in callback:', err);
        router.push('/auth/error?error=An unexpected error occurred');
      }
    };

    // Only run if we have query params
    if (router.isReady) {
      handleCallback();
    }
  }, [router, supabase]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 text-xl font-semibold text-red-600">Authentication Error</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="mb-2 text-xl font-semibold">Completing sign in...</h2>
        <p className="text-gray-600">Please wait while we verify your credentials.</p>
      </div>
    </div>
  );
} 