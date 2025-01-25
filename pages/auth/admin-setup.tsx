import { createUserOrganization } from '@/src/utils/organization';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import AuthLayout from '../../components/auth/AuthLayout';

export default function AdminSetup() {
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [origin, setOrigin] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  // Check if user is authenticated
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        console.error('[ADMIN-SETUP] No session found:', error);
        router.replace('/auth/signin');
      }
    };
    checkSession();
  }, [router, supabase.auth]);

  const handleGoogleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setError(null);
      setLoading(true);

      if (!orgName.trim()) {
        setError('Please enter an organization name');
        return;
      }

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Could not get user details');
      }

      // Create organization
      try {
        await createUserOrganization(supabase, user.id, user.email || '');
        console.log('[ADMIN-SETUP] Organization created successfully');
      } catch (orgError) {
        console.error('[ADMIN-SETUP] Error creating organization:', orgError);
        throw new Error('Failed to create organization');
      }

      // Start Google OAuth
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;

      if (data?.url) {
        console.log('[ADMIN-SETUP] Redirecting to Google auth');
        window.location.href = data.url;
      } else {
        throw new Error('No OAuth URL received');
      }
    } catch (error) {
      console.error('[ADMIN-SETUP] Error:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Set up your organization">
      <form onSubmit={handleGoogleAuth} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-lg text-sm font-medium animate-fade-in">
            {error}
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="orgName" className="block text-sm font-medium text-gray-900">
            Organization Name
          </label>
          <input
            id="orgName"
            type="text"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            required
            className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-500 transition-colors duration-200 ease-in-out focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            placeholder="Your Company Name"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center py-2.5 px-4 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M23.766 12.2764C23.766 11.4607 23.6999 10.6406 23.5588 9.83807H12.24V14.4591H18.7217C18.4528 15.9494 17.5885 17.2678 16.323 18.1056V21.1039H20.19C22.4608 19.0139 23.766 15.9274 23.766 12.2764Z" fill="#4285F4"/>
            <path d="M12.24 24.0008C15.4764 24.0008 18.2058 22.9382 20.1944 21.1039L16.3274 18.1055C15.2516 18.8375 13.8626 19.252 12.24 19.252C9.07376 19.252 6.39389 17.1399 5.44176 14.3003H1.45166V17.3912C3.50195 21.4434 7.63825 24.0008 12.24 24.0008Z" fill="#34A853"/>
            <path d="M5.44175 14.3003C5.21164 13.5681 5.08083 12.7862 5.08083 12.0008C5.08083 11.2154 5.21164 10.4335 5.44175 9.70129V6.61041H1.45165C0.524374 8.23827 0 10.0657 0 12.0008C0 13.9359 0.524374 15.7633 1.45165 17.3912L5.44175 14.3003Z" fill="#FBBC05"/>
            <path d="M12.24 4.74966C14.0291 4.74966 15.6265 5.36715 16.8902 6.56198L20.2694 3.18264C18.1999 1.21215 15.4708 0 12.24 0C7.63825 0 3.50195 2.55737 1.45166 6.61038L5.44176 9.70126C6.39389 6.86173 9.07376 4.74966 12.24 4.74966Z" fill="#EA4335"/>
          </svg>
          <span className="ml-2">{loading ? 'Setting up...' : 'Continue with Google'}</span>
        </button>
      </form>
    </AuthLayout>
  );
} 