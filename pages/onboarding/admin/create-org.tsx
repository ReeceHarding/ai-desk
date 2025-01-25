import { logger } from '@/utils/logger';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/router';
import { useState } from 'react';

export default function CreateAdminOrg() {
  const router = useRouter();
  const [orgName, setOrgName] = useState('');
  const [orgLogoUrl, setOrgLogoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) {
      setError('Please enter an organization name');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      logger.info('[ADMIN_CREATE_ORG] Creating new organization:', { 
        name: orgName 
      });

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        logger.error('[ADMIN_CREATE_ORG] Auth error:', { error: userError });
        setError('Could not verify your identity');
        return;
      }

      // Get user's profile to ensure it exists
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('id', user.id)
        .single();

      if (profileError) {
        logger.error('[ADMIN_CREATE_ORG] Profile fetch error:', { error: profileError });
        setError('Could not find your profile');
        return;
      }

      // Create new organization with slug
      const { data: newOrg, error: createError } = await supabase
        .from('organizations')
        .insert([{
          name: orgName.trim(),
          avatar_url: orgLogoUrl || null,
          created_by: user.id,
          owner_id: user.id,
          email: profile.email,
          public_mode: false,
          sla_tier: 'basic'
        }])
        .select()
        .single();

      if (createError) {
        logger.error('[ADMIN_CREATE_ORG] Org creation error:', { error: createError });
        setError('Failed to create organization');
        return;
      }

      // Update user's profile with org_id and ensure admin role
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          org_id: newOrg.id,
          role: 'admin',
          metadata: {
            signup_completed: true,
            onboarding_started_at: new Date().toISOString(),
            org_created_at: new Date().toISOString()
          }
        })
        .eq('id', user.id);

      if (updateError) {
        logger.error('[ADMIN_CREATE_ORG] Profile update error:', { error: updateError });
        setError('Failed to update your profile');
        return;
      }

      // Add user as an admin in organization_members
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert([{
          organization_id: newOrg.id,
          user_id: user.id,
          role: 'admin'
        }]);

      if (memberError) {
        logger.error('[ADMIN_CREATE_ORG] Member insert error:', { error: memberError });
        setError('Failed to add you as an admin');
        return;
      }

      logger.info('[ADMIN_CREATE_ORG] Organization created successfully:', {
        orgId: newOrg.id,
        userId: user.id
      });

      // Redirect to Gmail connection
      router.push('/onboarding/admin/connect-gmail');
    } catch (err) {
      logger.error('[ADMIN_CREATE_ORG] Unexpected error:', { error: err });
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center space-x-4 mb-8">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center">
              1
            </div>
            <div className="ml-2 text-sm font-medium text-blue-600">Organization</div>
          </div>
          <div className="flex items-center">
            <div className="w-8 h-8 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center">
              2
            </div>
            <div className="ml-2 text-sm font-medium text-gray-600">Gmail</div>
          </div>
          <div className="flex items-center">
            <div className="w-8 h-8 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center">
              3
            </div>
            <div className="ml-2 text-sm font-medium text-gray-600">Done</div>
          </div>
        </div>

        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Create Your Organization
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Set up your organization as an administrator
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleCreateOrg} className="space-y-6">
            <div>
              <label htmlFor="orgName" className="block text-sm font-medium text-gray-700">
                Organization Name
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  id="orgName"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Enter organization name"
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="logoUrl" className="block text-sm font-medium text-gray-700">
                Logo URL (Optional)
              </label>
              <div className="mt-1">
                <input
                  type="url"
                  id="logoUrl"
                  value={orgLogoUrl}
                  onChange={(e) => setOrgLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Provide a URL to your organization's logo (optional)
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading || !orgName.trim()}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isLoading ? 'Creating Organization...' : 'Create Organization'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
} 