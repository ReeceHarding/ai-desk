import { logger } from '@/utils/logger';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/router';
import { useState } from 'react';

// Function to generate a URL-friendly slug
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric chars with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

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

      // Generate a base slug from the organization name
      const baseSlug = generateSlug(orgName);
      
      // Check if the slug exists and generate a unique one if needed
      let finalSlug = baseSlug;
      let counter = 1;
      
      while (true) {
        const { data: existingOrg, error: slugCheckError } = await supabase
          .from('organizations')
          .select('id')
          .eq('slug', finalSlug)
          .single();
          
        if (slugCheckError && slugCheckError.code === 'PGRST116') {
          // PGRST116 means no rows returned, which is what we want
          break;
        }
        
        if (slugCheckError) {
          logger.error('[ADMIN_CREATE_ORG] Error checking slug:', { error: slugCheckError });
          setError('Failed to generate organization URL');
          return;
        }
        
        if (!existingOrg) {
          break;
        }
        
        // If slug exists, try the next number
        finalSlug = `${baseSlug}-${counter}`;
        counter++;
      }

      // Create new organization with slug
      logger.info('[ADMIN_CREATE_ORG] Attempting to create organization:', {
        name: orgName.trim(),
        userId: user.id,
        email: profile.email
      });

      const { data: newOrg, error: createError } = await supabase
        .from('organizations')
        .insert([{
          name: orgName.trim(),
          slug: finalSlug,
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
        logger.error('[ADMIN_CREATE_ORG] Org creation error:', { 
          error: createError,
          errorCode: createError.code,
          details: createError.details,
          hint: createError.hint,
          message: createError.message
        });
        setError('Failed to create organization. Please try again.');
        return;
      }

      logger.info('[ADMIN_CREATE_ORG] Organization created successfully:', {
        orgId: newOrg.id,
        name: newOrg.name,
        slug: finalSlug
      });

      // Update user's profile with org_id and ensure admin role
      logger.info('[ADMIN_CREATE_ORG] Updating user profile:', {
        userId: user.id,
        orgId: newOrg.id
      });

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
        logger.error('[ADMIN_CREATE_ORG] Profile update error:', { 
          error: updateError,
          errorCode: updateError.code,
          details: updateError.details,
          hint: updateError.hint,
          message: updateError.message
        });
        
        // If profile update fails, clean up the organization
        const { error: deleteError } = await supabase
          .from('organizations')
          .delete()
          .eq('id', newOrg.id);
          
        if (deleteError) {
          logger.error('[ADMIN_CREATE_ORG] Failed to cleanup organization after profile update failed:', {
            error: deleteError,
            orgId: newOrg.id
          });
        }
        
        setError('Failed to update your profile. Please try again.');
        return;
      }

      logger.info('[ADMIN_CREATE_ORG] Profile updated successfully');

      // Add user as an admin in organization_members
      logger.info('[ADMIN_CREATE_ORG] Adding user as organization admin:', {
        userId: user.id,
        orgId: newOrg.id
      });

      const { error: memberError } = await supabase
        .from('organization_members')
        .insert([{
          organization_id: newOrg.id,
          user_id: user.id,
          role: 'admin',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);

      if (memberError) {
        logger.error('[ADMIN_CREATE_ORG] Member insert error:', { 
          error: memberError,
          errorCode: memberError.code,
          details: memberError.details,
          hint: memberError.hint,
          message: memberError.message
        });
        
        // If member creation fails, clean up the organization and profile update
        const { error: deleteError } = await supabase
          .from('organizations')
          .delete()
          .eq('id', newOrg.id);
          
        if (deleteError) {
          logger.error('[ADMIN_CREATE_ORG] Failed to cleanup organization after member creation failed:', {
            error: deleteError,
            orgId: newOrg.id
          });
        }
        
        // Reset the profile
        const { error: resetError } = await supabase
          .from('profiles')
          .update({ 
            org_id: null,
            role: 'customer',
            metadata: {
              signup_completed: false
            }
          })
          .eq('id', user.id);
          
        if (resetError) {
          logger.error('[ADMIN_CREATE_ORG] Failed to reset profile after member creation failed:', {
            error: resetError,
            userId: user.id
          });
        }
        
        setError('Failed to add you as an admin. Please try again.');
        return;
      }

      logger.info('[ADMIN_CREATE_ORG] Organization member created successfully:', {
        orgId: newOrg.id,
        userId: user.id,
        role: 'admin'
      });

      logger.info('[ADMIN_CREATE_ORG] Organization creation process completed successfully');

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

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                  isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isLoading ? 'Creating...' : 'Create Organization'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 