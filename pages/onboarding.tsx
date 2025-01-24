import { Database } from '@/types/supabase';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function Onboarding() {
  const [role, setRole] = useState<'customer' | 'agent' | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const supabase = useSupabaseClient<Database>();
  const user = useUser();
  const router = useRouter();

  useEffect(() => {
    // If no user, redirect to signin
    if (user === null) {
      console.log('[Onboarding] No user found, redirecting to signin');
      router.push('/auth/signin');
    }
  }, [user, router]);

  // If user is still loading, show loading state
  if (user === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Loading...
          </h2>
        </div>
      </div>
    );
  }

  // If no user, don't render the form
  if (user === null) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[Onboarding] Form submitted:', { name, role });

    if (!user) {
      console.log('[Onboarding] No user found, cannot proceed');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      // Check if profile exists first
      console.log('[Onboarding] Checking for existing profile...');
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (existingProfile) {
        console.log('[Onboarding] Updating existing profile');
      } else {
        console.log('[Onboarding] Creating new profile');
        // Check if user exists in auth
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

        if (authError || !authUser) {
          console.error('[Onboarding] User not found in auth:', authError);
          setError('Unable to verify user. Please try signing out and back in.');
          return;
        }

        // Add a small delay to ensure user record exists
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log('[Onboarding] Updating profile for user:', user.id);
      // Update user's profile with display name and role
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          display_name: name,
          role: role,
          email: user.email
        });

      if (profileError) {
        console.error('[Onboarding] Profile update failed:', profileError);
        throw profileError;
      }
      console.log('[Onboarding] Profile updated successfully');

      // Get or create user's organization
      console.log('[Onboarding] Fetching/creating organization');
      let org;
      
      // First try to find existing organization
      const { data: existingOrg, error: fetchError } = await supabase
        .from('organizations')
        .select('slug')
        .eq('owner_id', user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        console.error('[Onboarding] Organization fetch failed:', fetchError);
        throw fetchError;
      }

      if (existingOrg) {
        console.log('[Onboarding] Found existing organization:', existingOrg);
        org = existingOrg;
      } else {
        // Create new organization
        console.log('[Onboarding] Creating new organization');
        const orgName = `${name}'s Organization`;
        
        // First generate a unique slug
        const { data: slugData, error: slugError } = await supabase
          .rpc('generate_unique_slug', { org_name: orgName });

        if (slugError) {
          console.error('[Onboarding] Slug generation failed:', slugError);
          throw slugError;
        }

        const { data: newOrg, error: createError } = await supabase
          .from('organizations')
          .insert({
            name: orgName,
            slug: slugData,
            owner_id: user.id
          })
          .select('slug, id')
          .single();

        if (createError) {
          console.error('[Onboarding] Organization creation failed:', createError);
          throw createError;
        }
        console.log('[Onboarding] Created new organization:', newOrg);

        // Create organization member entry
        const { error: memberError } = await supabase
          .from('organization_members')
          .insert({
            organization_id: newOrg.id,
            user_id: user.id,
            role: 'admin' // Owner is automatically an admin
          });

        if (memberError) {
          console.error('[Onboarding] Organization member creation failed:', memberError);
          throw memberError;
        }
        console.log('[Onboarding] Created organization member entry');

        org = newOrg;

        // Update profile with org_id
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ org_id: org.id })
          .eq('id', user.id);

        if (updateError) {
          console.error('[Onboarding] Profile org_id update failed:', updateError);
          throw updateError;
        }
      }

      // Redirect based on role
      const destination = role === 'customer' 
        ? `/${org.slug}/new-ticket`
        : `/${org.slug}/settings/gmail`;
      
      console.log('[Onboarding] Redirecting to:', destination);
      router.push(destination);
    } catch (err) {
      console.error('[Onboarding] Error during submission:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Log initial mount and user state
  console.log('[Onboarding] Component mounted, user:', user?.id);

  return (
    <>
      <Head>
        <title>Welcome to Zendesk - Complete Your Profile</title>
        <meta name="description" content="Complete your profile to get started with Zendesk" />
      </Head>

      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Welcome to Zendesk
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Let's get you set up
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Your Name
                </label>
                <input
                  type="text"
                  id="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  I am a...
                </label>
                <div className="mt-4 space-y-4">
                  <div className="flex items-center">
                    <input
                      id="customer"
                      name="role"
                      type="radio"
                      required
                      checked={role === 'customer'}
                      onChange={() => setRole('customer')}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                    />
                    <label htmlFor="customer" className="ml-3 block text-sm font-medium text-gray-700">
                      Customer with a question
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      id="agent"
                      name="role"
                      type="radio"
                      required
                      checked={role === 'agent'}
                      onChange={() => setRole('agent')}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                    />
                    <label htmlFor="agent" className="ml-3 block text-sm font-medium text-gray-700">
                      Support Agent
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading || !role}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {loading ? 'Setting up...' : 'Continue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
} 