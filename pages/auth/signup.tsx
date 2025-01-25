import { logger } from '@/utils/logger';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useEffect, useState } from 'react';
import AuthLayout from '../../components/auth/AuthLayout';

// At the top of the file, after imports
interface GoogleCredentialResponse {
  credential: string;
  select_by: string;
  client_id: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
            auto_select?: boolean;
            context?: string;
          }) => void;
          renderButton: (
            element: HTMLElement,
            config: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: number | string;
            }
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClientComponentClient({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  });

  useEffect(() => {
    // Log initial configuration
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_AUTH_CLIENT_ID;
    const redirectUrl = process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL;
    
    logger.info('[SIGNUP_PAGE] Environment Configuration:', {
      supabase: {
        url: supabaseUrl,
        hasAnonKey: !!supabaseKey,
        anonKeyPrefix: supabaseKey?.substring(0, 8) + '...',
        client: {
          hasSupabase: !!supabase,
          hasAuth: !!supabase?.auth,
        }
      },
      google: {
        hasClientId: !!googleClientId,
        clientIdPrefix: googleClientId?.substring(0, 8) + '...',
        redirectUrl: redirectUrl || window.location.origin + '/auth/callback',
      },
      env: {
        nodeEnv: process.env.NODE_ENV,
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        hasGoogleClientId: !!process.env.NEXT_PUBLIC_GOOGLE_AUTH_CLIENT_ID,
        hasRedirectUrl: !!process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL,
      },
      runtime: {
        origin: window.location.origin,
        protocol: window.location.protocol,
        host: window.location.host,
      }
    });
  }, []);

  useEffect(() => {
    logger.info('[SIGNUP_PAGE] Mounted', {
      query: router.query,
      pathname: router.pathname,
      origin: window.location.origin
    });
  }, [router]);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);

      logger.info('========== GOOGLE SIGN-IN START ==========');

      // Log the current URL and origin
      logger.info('[SIGNUP_PAGE] Current location:', {
        href: window.location.href,
        origin: window.location.origin,
        pathname: window.location.pathname,
        search: window.location.search
      });

      // Generate PKCE code verifier and challenge
      const codeVerifier = generatePKCEVerifier();
      const codeChallenge = await generatePKCEChallenge(codeVerifier);

      // Store the code verifier in localStorage
      const codeVerifierKey = `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]}-auth-token-code-verifier`;
      
      // Clear any existing verifier first
      localStorage.removeItem(codeVerifierKey);
      
      // Store the new verifier
      localStorage.setItem(codeVerifierKey, codeVerifier);

      // Verify storage was successful
      const storedVerifier = localStorage.getItem(codeVerifierKey);
      if (!storedVerifier || storedVerifier !== codeVerifier) {
        logger.error('Failed to store code verifier in localStorage');
        setError('Failed to initialize authentication. Please try again.');
        return;
      }

      logger.info('[SIGNUP_PAGE] PKCE details:', {
        codeVerifierKey,
        hasCodeVerifier: !!codeVerifier,
        hasCodeChallenge: !!codeChallenge,
        verifierLength: codeVerifier.length,
        challengeLength: codeChallenge.length,
        verifierType: typeof codeVerifier,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        urlPart: process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1],
        storedVerifier: localStorage.getItem(codeVerifierKey),
        redirectUrl: `${window.location.origin}/auth/callback`,
        fullRedirectUrl: new URL('/auth/callback', window.location.origin).toString()
      });

      // Log the OAuth configuration
      logger.info('[SIGNUP_PAGE] OAuth configuration:', {
        provider: 'google',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
          code_challenge_method: 'S256'
        }
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
            code_challenge: codeChallenge,
            code_challenge_method: 'S256'
          },
          skipBrowserRedirect: false
        }
      });

      if (error) {
        logger.error('OAuth Error:', error);
        setError(error.message);
        return;
      }

      if (!data) {
        logger.error('No OAuth data returned');
        setError('Failed to initiate Google sign in');
        return;
      }

      logger.info('Sign in successful:', data);

    } catch (err) {
      logger.error('Unexpected error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // PKCE Helper Functions
  function generatePKCEVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return base64URLEncode(array);
  }

  async function generatePKCEChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return base64URLEncode(new Uint8Array(hash));
  }

  function base64URLEncode(array: Uint8Array): string {
    return btoa(String.fromCharCode.apply(null, Array.from(array)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  const handleEmailSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        setError(error.message);
        return;
      }

      if (!data.user) {
        setError('Failed to create account');
        return;
      }

      // Check if email verification is required
      if (data.session) {
        // User is already signed in, redirect to role selection
        router.push('/onboarding/select-role');
      } else if (data.user.identities?.length === 0) {
        // No identities means email verification is required
        router.push('/auth/verify-email');
      } else {
        // Default to role selection
        router.push('/onboarding/select-role');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create an account">
      <div className="flex flex-col space-y-4">
        <form onSubmit={handleEmailSignUp} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">{error}</h3>
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Sign up with email'}
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-2 text-gray-500">Or continue with</span>
          </div>
        </div>

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
        >
          <svg className="h-5 w-5" aria-hidden="true" viewBox="0 0 24 24">
            <path
              d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"
              fill="currentColor"
            />
          </svg>
          <span>{loading ? 'Signing in...' : 'Sign up with Google'}</span>
        </button>

        <p className="text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/auth/signin" className="font-medium text-indigo-600 hover:text-indigo-500">
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
} 