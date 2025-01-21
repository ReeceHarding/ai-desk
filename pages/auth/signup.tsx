import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import AuthLayout from '../../components/auth/AuthLayout';
import Link from 'next/link';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClientComponentClient({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate email format
      if (!validateEmail(email)) {
        throw new Error('Please enter a valid email address');
      }

      // Sign up the user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            email_confirmed: true
          }
        }
      });

      console.log('Signup response:', { signUpData, signUpError });

      if (signUpError) throw signUpError;

      if (signUpData?.user) {
        console.log('User created successfully:', signUpData.user);
        
        // Add a small delay to ensure the trigger completes
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('Checking for profile creation...');

        // Verify profile creation
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', signUpData.user.id)
          .single();

        console.log('Profile check result:', { profile, profileError });

        if (profileError) {
          console.error('Profile verification error:', profileError);
        }

        // Sign in after profile verification
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        // Redirect to dashboard
        router.push('/dashboard');
      } else {
        throw new Error('Failed to create user account');
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create your account">
      <form onSubmit={handleSignUp} className="space-y-6">
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
            minLength={6}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-500 transition-colors duration-200 ease-in-out focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            placeholder="••••••••"
          />
          <p className="mt-2 text-sm text-gray-600">
            Must be at least 6 characters
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="relative w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out"
        >
          {loading ? (
            <>
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </span>
              <span className="pl-8">Creating account...</span>
            </>
          ) : (
            'Create account'
          )}
        </button>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or sign up with</span>
            </div>
          </div>

          <div className="mt-6">
            <button
              type="button"
              disabled
              className="w-full inline-flex items-center justify-center py-2.5 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
              </svg>
              <span className="ml-2">Google (Coming Soon)</span>
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/auth/signin" className="font-medium text-blue-600 hover:text-blue-700 transition duration-150 ease-in-out">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
} 