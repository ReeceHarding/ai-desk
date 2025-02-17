import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useEffect, useState } from 'react';
import AuthLayout from '../../components/auth/AuthLayout';

export default function SignIn() {
  const router = useRouter();
  const { from } = router.query;
  const supabase = createClientComponentClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [origin, setOrigin] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const handleGoogleSignIn = async () => {
    console.log('[SIGNIN] Starting Google OAuth signin');
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/auth/callback?from=${encodeURIComponent(from as string || '/dashboard')}`,
        },
      });

      if (error) {
        console.error('[SIGNIN] Error signing in with Google:', error);
        setError(error.message);
        return;
      }

      console.log('[SIGNIN] Google OAuth successful, redirecting...');
      // Let Supabase handle the redirect
    } catch (error: any) {
      console.error('[SIGNIN] Unexpected error during Google signin:', error);
      setError(error.message);
    }
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('[SIGNIN] Starting password signin');
    
    try {
      setError(null);
      setIsLoading(true);

      const formData = new FormData(e.currentTarget);
      const email = formData.get('email') as string;
      const password = formData.get('password') as string;

      console.log('[SIGNIN] Attempting signin with email:', email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('[SIGNIN] Error signing in:', error);
        setError(error.message);
        return;
      }

      console.log('[SIGNIN] Signin successful:', {
        userId: data.user?.id,
        hasSession: !!data.session
      });

      // After successful signin, redirect to the from URL or dashboard
      router.push(from as string || '/dashboard');
    } catch (error: any) {
      console.error('[SIGNIN] Unexpected error during signin:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGitHubSignIn = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${origin}/auth/callback?from=${encodeURIComponent(from as string || '/dashboard')}`,
      },
    });

    if (error) {
      console.error('Error signing in with GitHub:', error.message);
      return;
    }

    // Let Supabase handle the redirect
  };

  return (
    <AuthLayout title="Welcome back">
      <form onSubmit={handleSignIn} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-lg text-sm font-medium animate-fade-in">
            {error}
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm font-medium text-gray-900">
            Work Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-500 transition-colors duration-200 ease-in-out focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            placeholder="you@company.com"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm font-medium text-gray-900">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-500 transition-colors duration-200 ease-in-out focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            placeholder="••••••••"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <input
              id="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-2 transition duration-150 ease-in-out"
            />
            <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700 select-none">
              Keep me signed in
            </label>
          </div>
          <Link
            href="/auth/forgot-password"
            className="text-sm font-medium text-blue-600 hover:text-blue-700 transition duration-150 ease-in-out"
          >
            Forgot your password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="relative w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out"
        >
          {isLoading ? (
            <>
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </span>
              <span className="pl-8">Signing in...</span>
            </>
          ) : (
            'Sign in'
          )}
        </button>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or sign in with</span>
            </div>
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full inline-flex items-center justify-center py-2.5 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M23.766 12.2764C23.766 11.4607 23.6999 10.6406 23.5588 9.83807H12.24V14.4591H18.7217C18.4528 15.9494 17.5885 17.2678 16.323 18.1056V21.1039H20.19C22.4608 19.0139 23.766 15.9274 23.766 12.2764Z" fill="#4285F4"/>
                <path d="M12.24 24.0008C15.4764 24.0008 18.2058 22.9382 20.1944 21.1039L16.3274 18.1055C15.2516 18.8375 13.8626 19.252 12.24 19.252C9.07376 19.252 6.39389 17.1399 5.44176 14.3003H1.45166V17.3912C3.50195 21.4434 7.63825 24.0008 12.24 24.0008Z" fill="#34A853"/>
                <path d="M5.44175 14.3003C5.21164 13.5681 5.08083 12.7862 5.08083 12.0008C5.08083 11.2154 5.21164 10.4335 5.44175 9.70129V6.61041H1.45165C0.524374 8.23827 0 10.0657 0 12.0008C0 13.9359 0.524374 15.7633 1.45165 17.3912L5.44175 14.3003Z" fill="#FBBC05"/>
                <path d="M12.24 4.74966C14.0291 4.74966 15.6265 5.36715 16.8902 6.56198L20.2694 3.18264C18.1999 1.21215 15.4708 0 12.24 0C7.63825 0 3.50195 2.55737 1.45166 6.61038L5.44176 9.70126C6.39389 6.86173 9.07376 4.74966 12.24 4.74966Z" fill="#EA4335"/>
              </svg>
              <span className="ml-2">Continue with Google</span>
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-gray-600">
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" className="font-medium text-blue-600 hover:text-blue-700 transition duration-150 ease-in-out">
            Sign up
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
} 