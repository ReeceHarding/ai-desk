import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Organization {
  id: string;
  name: string;
  email: string;
}

interface OrganizationSearchProps {
  userId: string;
  onSelect: (orgId: string) => void;
  isLoading?: boolean;
}

export function OrganizationSearch({ userId, onSelect, isLoading = false }: OrganizationSearchProps) {
  const [search, setSearch] = useState('');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const supabase = useSupabaseClient();

  useEffect(() => {
    const searchOrganizations = async () => {
      try {
        setLoading(true);
        setError('');

        const query = supabase
          .from('organizations')
          .select('id, name, email')
          .eq('config->is_current', true);

        if (search) {
          query.ilike('name', `%${search}%`);
        }

        const { data, error } = await query.limit(10);

        if (error) throw error;

        setOrganizations(data || []);
      } catch (err) {
        console.error('Error searching organizations:', err);
        setError('Failed to search organizations. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    const debounceTimeout = setTimeout(searchOrganizations, 300);
    return () => clearTimeout(debounceTimeout);
  }, [search, supabase]);

  const handleSelect = async (orgId: string) => {
    try {
      setLoading(true);
      setError('');

      // First, unset is_current flag on all organizations
      const { data: updateOldData, error: updateOldError } = await supabase
        .rpc('update_org_config', {
          p_user_id: userId,
          p_is_current: false
        });

      if (updateOldError || !updateOldData?.success) {
        throw new Error(updateOldData?.message || 'Failed to update organization settings');
      }

      // Set is_current flag on the selected organization
      const { data: updateNewData, error: updateNewError } = await supabase
        .rpc('update_org_config', {
          p_org_id: orgId,
          p_is_current: true
        });

      if (updateNewError || !updateNewData?.success) {
        throw new Error(updateNewData?.message || 'Failed to update organization settings');
      }

      // Associate user with organization
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: orgId,
          user_id: userId,
          role: 'agent',
          created_at: new Date().toISOString()
        });

      if (memberError) throw memberError;

      // Update profile with org_id
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          org_id: orgId,
          metadata: {
            org_selected_at: new Date().toISOString()
          }
        })
        .eq('id', userId);

      if (profileError) throw profileError;

      onSelect(orgId);
    } catch (err) {
      console.error('Error joining organization:', err);
      setError('Failed to join organization. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Select Your Organization</h2>
        <p className="mt-1 text-sm text-gray-500">
          Search for the organization you work with.
        </p>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="search" className="block text-sm font-medium text-gray-700">
            Search Organizations
          </label>
          <Input
            id="search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mt-1"
            placeholder="Enter organization name..."
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          {loading || isLoading ? (
            <div className="flex justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : organizations.length > 0 ? (
            organizations.map((org) => (
              <div
                key={org.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
              >
                <div>
                  <h3 className="font-medium">{org.name}</h3>
                  <p className="text-sm text-gray-500">{org.email}</p>
                </div>
                <Button
                  onClick={() => handleSelect(org.id)}
                  disabled={loading || isLoading}
                  variant="outline"
                >
                  Join
                </Button>
              </div>
            ))
          ) : (
            <p className="text-center text-gray-500 py-4">
              {search ? 'No organizations found' : 'Start typing to search organizations'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
} 