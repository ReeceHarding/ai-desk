import { useEffect, useState } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { Database } from '../../types/supabase';

type Organization = Database['public']['Tables']['organizations']['Row'];

export default function OrganizationManagement() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = useSupabaseClient<Database>();
  const user = useUser();

  useEffect(() => {
    // Redirect if not logged in
    if (!user) {
      window.location.href = '/auth/signin';
      return;
    }

    fetchOrganizations();
  }, [user]);

  const fetchOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*');

      if (error) throw error;

      setOrganizations(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch organizations');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return null; // Will redirect in useEffect
  }

  if (isLoading) {
    return <div className="p-4">Loading organizations...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 p-4 shadow-lg">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">FlowSupport</h1>
          <div className="flex items-center gap-4">
            <span>{user.email}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Organizations</h2>
          <button 
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg"
          >
            Create New Org
          </button>
        </div>

        {organizations.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No organizations found.
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left">Name</th>
                  <th className="px-6 py-3 text-left">SLA Tier</th>
                  <th className="px-6 py-3 text-left">Created At</th>
                  <th className="px-6 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((org) => (
                  <tr key={org.id} className="border-t border-gray-700">
                    <td className="px-6 py-4">{org.name}</td>
                    <td className="px-6 py-4">{org.sla_tier}</td>
                    <td className="px-6 py-4">
                      {new Date(org.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        className="text-blue-400 hover:text-blue-300 mr-3"
                      >
                        Edit
                      </button>
                      <button 
                        className="text-red-400 hover:text-red-300"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
} 