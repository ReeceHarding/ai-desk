import { logger } from '@/utils/logger';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function Callback() {
  const router = useRouter();
  const supabase = createClientComponentClient({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  });

  useEffect(() => {
    const handleCallback = async () => {
      logger.info('========== GOOGLE AUTH CALLBACK START ==========');

      // Log environment configuration
      logger.info('[CALLBACK_PAGE] Environment Configuration:', {
        supabase: {
          url: process.env.NEXT_PUBLIC_SUPABASE_URL,
          hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          anonKeyPrefix: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 8) + '...',
          client: {
            hasSupabase: !!supabase,
            hasAuth: !!supabase?.auth,
          }
        },
        google: {
          hasClientId: !!process.env.NEXT_PUBLIC_GOOGLE_AUTH_CLIENT_ID,
          clientIdPrefix: process.env.NEXT_PUBLIC_GOOGLE_AUTH_CLIENT_ID?.substring(0, 8) + '...',
          redirectUrl: process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL || window.location.origin + '/auth/callback',
        },
        runtime: {
          origin: window.location.origin,
          protocol: window.location.protocol,
          host: window.location.host,
          currentUrl: window.location.href
        }
      });

      try {
        // Log the current URL and query parameters
        logger.info('[CALLBACK_PAGE] Current location:', {
          href: window.location.href,
          origin: window.location.origin,
          pathname: window.location.pathname,
          search: window.location.search,
          hash: window.location.hash,
          query: router.query
        });

        // Check for OAuth errors first
        if (router.query.error) {
          const errorMsg = router.query.error_description || router.query.error;
          logger.error('OAuth Error:', { error: errorMsg });
          router.push(`/auth/error?error=${encodeURIComponent(errorMsg as string)}`);
          return;
        }

        // Get the code verifier from localStorage with the correct key format
        const codeVerifierKey = `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]}-auth-token-code-verifier`;
        const encodedVerifier = localStorage.getItem(codeVerifierKey);
        
        // Log all localStorage keys for debugging
        const allStorageKeys = Object.keys(localStorage);
        logger.info('[CALLBACK_PAGE] All localStorage keys:', {
          keys: allStorageKeys,
          totalKeys: allStorageKeys.length
        });

        logger.info('[CALLBACK_PAGE] Code verifier details:', {
          key: codeVerifierKey,
          encodedVerifier,
          hasVerifier: !!encodedVerifier,
          verifierType: typeof encodedVerifier,
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          urlPart: process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1],
          verifierLength: encodedVerifier?.length,
          allStorageKeys: Object.keys(localStorage)
        });

        if (!encodedVerifier) {
          logger.error('No code verifier found in localStorage');
          router.push('/auth/error?error=No code verifier found. Please try signing in again.');
          return;
        }

        // Exchange the code for a session using the current URL
        logger.info('Calling exchangeCodeForSession with:', {
          url: window.location.href,
          hasCodeVerifier: !!encodedVerifier,
          verifierLength: encodedVerifier.length,
          code: router.query.code
        });

        // Ensure we have both code and verifier before proceeding
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

        // Log successful authentication
        logger.info('Authentication successful', {
          user: data.session.user.email,
          provider: data.session.user.app_metadata.provider
        });

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

function decodeStateParam(state: string): any {
  try {
    const decoded = atob(state.split('.')[1]);
    return JSON.parse(decoded);
  } catch (error) {
    logger.error('[CALLBACK] Error decoding state param:', error);
    return null;
  }
}

async function getTokenScopes(token: string): Promise<string[] | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(atob(parts[1]));
    return payload.scope ? payload.scope.split(' ') : null;
  } catch (error) {
    logger.error('[CALLBACK] Error decoding token scopes:', error);
    return null;
  }
}

function getFlowStateId(state: string): string | null {
  try {
    const decoded = decodeStateParam(state);
    return decoded?.flow_state_id || null;
  } catch (error) {
    return null;
  }
} 