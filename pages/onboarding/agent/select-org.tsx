import { logger } from '@/utils/logger';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

interface Organization {
  id: string;
  name: string;
  slug: string;
  avatar_url?: string;
}

export default function AgentSelectOrg() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgLogo, setNewOrgLogo] = useState('');
  const supabase = createClientComponentClient();

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchTerm.length > 0) {
        setIsLoading(true);
        setError(null);

        try {
          logger.info('[AGENT_SELECT_ORG] Searching organizations:', { searchTerm });
          
          const { data, error } = await supabase
            .from('organizations')
            .select('id, name, slug, avatar_url')
            .ilike('name', `%${searchTerm}%`)
            .limit(10);

          if (error) {
            logger.error('[AGENT_SELECT_ORG] Search error:', { error });
            setError('Failed to search organizations');
            return;
          }

          setResults(data || []);
          logger.info('[AGENT_SELECT_ORG] Search results:', { count: data?.length });
        } catch (err) {
          logger.error('[AGENT_SELECT_ORG] Unexpected error:', { error: err });
          setError('An unexpected error occurred');
        } finally {
          setIsLoading(false);
        }
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, supabase]);

  const handleSelectOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrg) {
      setError('Please select an organization');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      logger.info('[AGENT_SELECT_ORG] Updating user organization:', { 
        orgId: selectedOrg.id,
        orgName: selectedOrg.name 
      });

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        logger.error('[AGENT_SELECT_ORG] Auth error:', { error: userError });
        setError('Could not verify your identity');
        return;
      }

      // Update the user's profile with the selected org
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          org_id: selectedOrg.id,
          metadata: {
            org_selected_at: new Date().toISOString(),
            is_agent: true
          }
        })
        .eq('id', user.id);

      if (updateError) {
        logger.error('[AGENT_SELECT_ORG] Profile update error:', { error: updateError });
        setError('Failed to update your organization');
        return;
      }

      // Add user as an agent in organization_members
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert([{
          organization_id: selectedOrg.id,
          user_id: user.id,
          role: 'agent',
          metadata: {
            joined_as_agent: true,
            joined_at: new Date().toISOString()
          }
        }])
        .select()
        .single();

      if (memberError) {
        logger.error('[AGENT_SELECT_ORG] Member insert error:', { error: memberError });
        setError('Failed to add you as an agent');
        return;
      }

      logger.info('[AGENT_SELECT_ORG] Organization selected successfully');
      router.push('/onboarding/agent/connect-gmail');
    } catch (err) {
      logger.error('[AGENT_SELECT_ORG] Unexpected error:', { error: err });
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) {
      setError('Please enter an organization name');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      logger.info('[AGENT_SELECT_ORG] Creating new organization:', { 
        name: newOrgName 
      });

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        logger.error('[AGENT_SELECT_ORG] Auth error:', { error: userError });
        setError('Could not verify your identity');
        return;
      }

      // Create new organization
      const { data: newOrg, error: createError } = await supabase
        .from('organizations')
        .insert([{
          name: newOrgName.trim(),
          avatar_url: newOrgLogo || null,
          created_by: user.id,
          owner_id: user.id,
          metadata: {
            created_by_agent: true,
            created_during_onboarding: true
          }
        }])
        .select()
        .single();

      if (createError) {
        logger.error('[AGENT_SELECT_ORG] Org creation error:', { error: createError });
        setError('Failed to create organization');
        return;
      }

      // Update user's profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          org_id: newOrg.id,
          metadata: {
            org_created_at: new Date().toISOString(),
            is_agent: true
          }
        })
        .eq('id', user.id);

      if (updateError) {
        logger.error('[AGENT_SELECT_ORG] Profile update error:', { error: updateError });
        setError('Failed to update your profile');
        return;
      }

      // Add user as an agent in organization_members
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert([{
          organization_id: newOrg.id,
          user_id: user.id,
          role: 'agent',
          metadata: {
            is_creator: true,
            joined_as_agent: true,
            joined_at: new Date().toISOString()
          }
        }]);

      if (memberError) {
        logger.error('[AGENT_SELECT_ORG] Member insert error:', { error: memberError });
        setError('Failed to add you as an agent');
        return;
      }

      logger.info('[AGENT_SELECT_ORG] Organization created successfully:', {
        orgId: newOrg.id
      });
      router.push('/onboarding/agent/connect-gmail');
    } catch (err) {
      logger.error('[AGENT_SELECT_ORG] Unexpected error:', { error: err });
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {showCreateForm ? 'Create Organization' : 'Find Your Organization'}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {showCreateForm 
            ? 'Set up a new organization for your team' 
            : 'Search for your company or create a new one'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
                      {error}
                  </div>
          )}

          {showCreateForm ? (
            <form onSubmit={handleCreateOrg} className="space-y-6">
              <div>
                <label htmlFor="orgName" className="block text-sm font-medium text-gray-700">
                  Organization Name
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    id="orgName"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
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
                    value={newOrgLogo}
                    onChange={(e) => setNewOrgLogo(e.target.value)}
                    placeholder="https://example.com/logo.png"
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Back to Search
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !newOrgName.trim()}
                  className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {isLoading ? 'Creating...' : 'Create Organization'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div>
                <label htmlFor="search" className="block text-sm font-medium text-gray-700">
                  Organization Name
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    id="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Type to search..."
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
            </div>

              {/* Results list */}
              {results.length > 0 && (
                <div className="mt-2 border border-gray-200 rounded-md divide-y divide-gray-200">
                  {results.map((org) => (
              <button
                      key={org.id}
                      onClick={() => {
                        setSelectedOrg(org);
                        setSearchTerm(org.name);
                      }}
                      className={`w-full px-4 py-3 flex items-center space-x-3 hover:bg-gray-50 focus:outline-none ${
                        selectedOrg?.id === org.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      {org.avatar_url ? (
                        <Image
                          src={org.avatar_url}
                          alt={org.name}
                          width={40}
                          height={40}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <span className="text-lg font-medium text-gray-600">
                            {org.name.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 text-left">
                        <div className="font-medium text-gray-900">{org.name}</div>
                        <div className="text-sm text-gray-500">@{org.slug}</div>
                      </div>
              </button>
                  ))}
                </div>
              )}

              {searchTerm && !isLoading && results.length === 0 && (
                <div className="text-center py-4 text-gray-500">
                  No organizations found
                </div>
              )}

              <div className="flex flex-col space-y-4">
              <button
                type="button"
                  onClick={() => setShowCreateForm(true)}
                  className="w-full py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                  Create New Organization
                </button>

                <form onSubmit={handleSelectOrg}>
                  <button
                    type="submit"
                    disabled={isLoading || !selectedOrg}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {isLoading ? 'Processing...' : 'Continue'}
              </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
