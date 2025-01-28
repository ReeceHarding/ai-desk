import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { debounce } from 'lodash';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useEffect, useState } from 'react';
import AuthLayout from '../../components/auth/AuthLayout';

interface Organization {
  id: string;
  name: string;
}

// Helper function to create organization and associate user
async function createUserOrganization(supabase: any, userId: string, email: string, orgName?: string) {
  try {
    console.group('[SIGNUP] Starting User Organization Creation');
    console.log('📝 Initial Parameters:', { userId, email, orgName });

    if (!userId || !email) {
      console.error('❌ Missing required parameters');
      console.groupEnd();
      throw new Error('User ID and email are required');
    }

    // Check for existing organization membership
    console.log('🔍 Checking existing organization membership...');
    const { data: existingMember } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .single();

    if (existingMember?.organization_id) {
      console.log('✅ User already has organization:', existingMember.organization_id);
      console.groupEnd();
      return;
    }
    console.log('✨ No existing organization membership found');

    // Check for existing profile
    console.log('🔍 Checking existing profile...');
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('id, org_id')
      .eq('id', userId)
      .single();

    if (profileCheckError && profileCheckError.code !== 'PGRST116') {
      console.error('❌ Profile check error:', profileCheckError);
      console.groupEnd();
      throw profileCheckError;
    }

    if (existingProfile?.org_id) {
      console.log('✅ Profile already has organization:', existingProfile.org_id);
      console.groupEnd();
      return;
    }
    console.log('✨ No existing profile found');

    // Admin flow
    if (orgName) {
      console.group('[SIGNUP] Admin Flow - Creating New Organization');
      console.log('📝 Creating organization:', orgName);
      
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({ 
          name: orgName.slice(0, 100),
          email: email,
          created_by: userId,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (orgError) {
        console.error('❌ Organization creation failed:', orgError);
        console.groupEnd();
        console.groupEnd();
        throw orgError;
      }
      console.log('✅ Organization created successfully:', org);

      console.log('📝 Creating admin profile...');
      const { data: newProfile, error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: email,
          display_name: email.split('@')[0],
          role: 'admin',
          org_id: org.id
        })
        .select()
        .single();

      if (profileError) {
        console.error('❌ Profile creation failed:', profileError);
        console.groupEnd();
        console.groupEnd();
        throw profileError;
      }
      console.log('✅ Admin profile created successfully:', newProfile);

      console.log('📝 Creating organization membership...');
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({ 
          organization_id: org.id,
          user_id: userId,
          role: 'admin',
          created_at: new Date().toISOString()
        });

      if (memberError) {
        console.error('❌ Organization membership creation failed:', memberError);
        console.groupEnd();
        console.groupEnd();
        throw memberError;
      }
      console.log('✅ Organization membership created successfully');
      console.groupEnd();
      console.groupEnd();
      return org;
    }

    // Customer flow
    console.group('[SIGNUP] Customer Flow - Creating Profile');
    console.log('📝 Creating customer profile...');
    const { data: newProfile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: email,
        display_name: email.split('@')[0],
        role: 'customer',
        org_id: null
      })
      .select()
      .single();

    if (profileError) {
      console.error('❌ Customer profile creation failed:', profileError);
      console.groupEnd();
      console.groupEnd();
      throw profileError;
    }
    console.log('✅ Customer profile created successfully:', newProfile);
    console.groupEnd();
    console.groupEnd();
    return null;
  } catch (error) {
    console.error('❌ [SIGNUP] Error in createUserOrganization:', error);
    console.groupEnd();
    throw error;
  }
}

// Helper function to search organizations
async function searchOrganizations(supabase: any, query: string): Promise<Organization[]> {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name')
    .ilike('name', `%${query}%`)
    .limit(5);

  if (error) {
    console.error('[SIGNUP] Error searching organizations:', error);
    throw error;
  }

  return data || [];
}

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const router = useRouter();
  const { type } = router.query;
  const supabase = createClientComponentClient({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  });
  const serviceRoleClient = createClientComponentClient({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
  });
  const [origin, setOrigin] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const debouncedSearch = debounce(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const results = await searchOrganizations(serviceRoleClient, query);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching organizations:', error);
    }
  }, 300);

  const handleOrgSearch = (query: string) => {
    setOrgName(query);
    setSelectedOrg(null);
    debouncedSearch(query);
  };

  const selectOrganization = (org: Organization) => {
    setSelectedOrg(org);
    setOrgName(org.name);
    setSearchResults([]);
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleGoogleSignIn = async () => {
    console.group('[SIGNUP] Google Sign In Process');
    console.time('google-signin');
    
    try {
      setError(null);
      setLoading(true);
      console.log('🔐 Initiating Google OAuth...');
      
      const { data, error } = await serviceRoleClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('❌ Google OAuth error:', error);
        throw error;
      }
      
      if (data?.url) {
        console.log('✅ OAuth URL received, redirecting...');
        window.location.href = data.url;
      } else {
        console.error('❌ No OAuth URL received');
        throw new Error('No OAuth URL received');
      }
    } catch (error: any) {
      console.error('❌ Error during Google sign in:', error);
      setError(error.message);
    } finally {
      setLoading(false);
      console.timeEnd('google-signin');
      console.groupEnd();
    }
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.group('[SIGNUP] Starting Sign Up Process');
    console.time('signup-process');
    
    try {
      setError(null);
      setLoading(true);
      console.log('📝 Validating input fields...');

      if (!validateEmail(email)) {
        console.warn('❌ Invalid email format');
        setError('Please enter a valid email address');
        return;
      }
      console.log('✅ Email format valid');

      if (password.length < 6) {
        console.warn('❌ Password too short');
        setError('Password must be at least 6 characters');
        return;
      }
      console.log('✅ Password length valid');

      if (type === 'admin' && !orgName) {
        console.warn('❌ Missing organization name');
        setError('Please enter an organization name');
        return;
      }

      console.log('🔐 Attempting user signup...', {
        email,
        redirectTo: `${origin}/auth/callback`,
        type,
        orgName: orgName || undefined
      });

      // Use regular client for auth operations
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${origin}/auth/callback`,
          data: {
            signup_type: type,
            org_name: orgName || undefined
          }
        },
      });

      if (signUpError) {
        console.error('❌ Signup failed:', {
          error: signUpError,
          code: signUpError.status,
          message: signUpError.message
        });
        throw signUpError;
      }

      if (!signUpData?.user) {
        console.error('❌ No user data received from signup');
        throw new Error('No user data received from signup');
      }

      console.log('✅ User signup successful:', {
        userId: signUpData.user.id,
        email: signUpData.user.email,
        type,
        orgName: orgName || undefined,
        hasSession: !!signUpData.session
      });

      // Create organization and profile regardless of session status
      // since email confirmation is disabled
      console.log('👤 Creating organization and profile...');
      try {
        await createUserOrganization(
          serviceRoleClient,
          signUpData.user.id,
          email,
          type === 'admin' ? orgName : undefined
        );
        console.log('✅ Organization and profile setup complete');
        
        if (signUpData.session) {
          console.log('🚀 Redirecting to dashboard...');
          router.push('/dashboard');
        } else {
          console.log('📧 Signup successful, session pending');
          setError('Signup successful! Please check your email to complete registration.');
        }
      } catch (orgError: any) {
        console.error('❌ Error setting up organization:', {
          error: orgError,
          message: orgError.message
        });
        throw new Error('Failed to set up organization: ' + orgError.message);
      }
    } catch (error: any) {
      console.error('❌ Error during signup:', {
        error,
        message: error.message,
        stack: error.stack
      });
      setError(error.message || 'An error occurred during signup');
    } finally {
      setLoading(false);
      console.timeEnd('signup-process');
      console.groupEnd();
    }
  };

  return (
    <AuthLayout title={
      type === 'admin' 
        ? 'Create Your Organization' 
        : type === 'agent'
        ? 'Join Your Organization'
        : 'Create an Account'
    }>
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
            {type === 'admin' 
              ? 'Create Your Organization' 
              : type === 'agent'
              ? 'Join Your Organization'
              : 'Create an Account'}
          </h2>
        </div>

        <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
          <form className="space-y-6" onSubmit={handleSignUp}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium leading-6 text-gray-900">
                Email address
              </label>
              <div className="mt-2">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium leading-6 text-gray-900">
                Password
              </label>
              <div className="mt-2">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                />
              </div>
            </div>

            {(type === 'admin' || type === 'agent') && (
              <div>
                <label htmlFor="organization" className="block text-sm font-medium leading-6 text-gray-900">
                  {type === 'admin' ? 'Organization Name' : 'Search Organization'}
                </label>
                <div className="mt-2 relative">
                  <input
                    id="organization"
                    name="organization"
                    type="text"
                    required
                    value={orgName}
                    onChange={(e) => handleOrgSearch(e.target.value)}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  />
                  {type === 'agent' && searchResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-200">
                      {searchResults.map((org) => (
                        <div
                          key={org.id}
                          className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                          onClick={() => selectOrganization(org)}
                        >
                          {org.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="text-red-600 text-sm">{error}</div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Sign up'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-2 text-gray-500">Or continue with</span>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-md bg-white px-3 py-1.5 text-sm font-semibold leading-6 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                <svg className="h-5 w-5" aria-hidden="true" viewBox="0 0 24 24">
                  <path
                    d="M12.0003 4.75C13.7703 4.75 15.3553 5.36002 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86002 8.87028 4.75 12.0003 4.75Z"
                    fill="#EA4335"
                  />
                  <path
                    d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z"
                    fill="#4285F4"
                  />
                  <path
                    d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.27028 9.7049L1.28027 6.60986C0.47027 8.22986 0 10.0599 0 11.9999C0 13.9399 0.47027 15.7699 1.28027 17.3899L5.26498 14.2949Z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12.0004 24C15.2354 24 17.9504 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.87043 19.245 6.21542 17.135 5.26544 14.29L1.27545 17.385C3.25045 21.31 7.31046 24 12.0004 24Z"
                    fill="#34A853"
                  />
                </svg>
                <span>Google</span>
              </button>
            </div>
          </div>

          <p className="mt-10 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link
              href="/auth/signin"
              className="font-semibold leading-6 text-indigo-600 hover:text-indigo-500"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
} 