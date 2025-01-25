import { logger } from '@/utils/logger';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function Callback() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const handleCallback = async () => {
      logger.info('========== GOOGLE AUTH CALLBACK START ==========');

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
        const encodedVerifier = localStorage.getItem(codeVerifierKey);

        if (!encodedVerifier) {
          logger.error('No code verifier found in localStorage');
          router.push('/auth/error?error=No code verifier found. Please try signing in again.');
          return;
        }

        if (!router.query.code) {
          logger.error('No auth code found in URL');
          router.push('/auth/error?error=No authorization code found');
          return;
        }

        // Create the full URL with the code
        const callbackURL = new URL(window.location.href);
        callbackURL.searchParams.set('code_verifier', encodedVerifier);

        const { data, error } = await supabase.auth.exchangeCodeForSession(callbackURL.toString());
        
        if (error) {
          logger.error('Session Exchange Error:', error);
          router.push(`/auth/error?error=${encodeURIComponent(error.message)}`);
          return;
        }

        if (!data.session) {
          logger.error('No session returned');
          router.push('/auth/error?error=No session returned from authentication');
          return;
        }

        // Clear the code verifier from localStorage
        localStorage.removeItem(codeVerifierKey);

        // Redirect to the appropriate page
        const redirectTo = localStorage.getItem('supabase.auth.redirectTo');
        if (redirectTo) {
          localStorage.removeItem('supabase.auth.redirectTo');
          router.push(redirectTo);
        } else {
          router.push('/onboarding/select-role');
        }
      } catch (error) {
        logger.error('Callback Error:', error);
        router.push('/auth/error?error=An unexpected error occurred during authentication');
      }
    };

    // Only run the callback handler when we have the code parameter
    if (router.query.code) {
      handleCallback();
    }
  }, [router, supabase]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="mb-2 text-xl font-semibold">Completing sign in...</h2>
        <p className="text-muted-foreground">Please wait while we verify your credentials.</p>
      </div>
    </div>
  );
} 