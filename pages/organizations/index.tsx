import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import { Database } from '../../types/supabase';

type Organization = Database['public']['Tables']['organizations']['Row'];

export default function OrganizationManagement() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = useSupabaseClient<Database>();
  const user = useUser();
  const router = useRouter();

  const fetchOrganizations = useCallback(async () => {
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
  }, [supabase]);

  useEffect(() => {
    // Redirect if not logged in
    if (!user) {
      router.push('/auth/signin');
      return;
    }

    fetchOrganizations();
  }, [user, router, fetchOrganizations]);

  if (!user) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle>Access Denied</CardTitle>
              <CardDescription>
                Please log in to view organizations
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Organizations</h1>
          <Button onClick={() => router.push('/organizations/new')}>
            Create Organization
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/3 mt-2"></div>
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card>
            <CardHeader>
              <CardTitle>Error</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        ) : organizations.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No Organizations</CardTitle>
              <CardDescription>
                Get started by creating your first organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push('/organizations/new')}>
                Create Organization
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {organizations.map((org) => (
              <Card key={org.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle>{org.name}</CardTitle>
                  <CardDescription>Organization ID: {org.id}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/organizations/${org.id}/settings`)}
                  >
                    Manage Organization
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
} 