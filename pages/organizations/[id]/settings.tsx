import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';

interface Organization {
  id: string;
  name: string;
  gmail_refresh_token?: string;
}

export default function OrganizationSettings() {
  const router = useRouter();
  const { id } = router.query;
  const supabase = useSupabaseClient();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const { role } = useUserRole();
  const isAdmin = role === 'admin' || role === 'super_admin';
  const [origin, setOrigin] = useState<string>('');

  const fetchOrganization = useCallback(async () => {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching organization:', error);
      return;
    }

    setOrganization(data);
  }, [supabase, id]);

  useEffect(() => {
    if (id) {
      fetchOrganization();
    }
  }, [id, fetchOrganization]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    // Check for success/error query params
    if (router.query.success) {
      toast({
        title: "Gmail Connected",
        description: "Your organization&apos;s Gmail account has been successfully connected.",
        variant: "default",
      });
      // Remove query param
      router.replace(`/organizations/${id}/settings`, undefined, { shallow: true });
    } else if (router.query.error) {
      toast({
        title: "Connection Failed",
        description: "Failed to connect Gmail account. Please try again.",
        variant: "destructive",
      });
      // Remove query param
      router.replace(`/organizations/${id}/settings`, undefined, { shallow: true });
    }
  }, [router.query, id, router]);

  const handleConnectGmail = async () => {
    if (!organization) return;

    try {
      const response = await fetch('/api/gmail/auth-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId: organization.id,
          redirectUri: `${origin}/api/gmail/callback`,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get auth URL');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Error initiating Gmail connection:', error);
      toast({
        title: 'Error',
        description: 'Failed to connect Gmail. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle>Access Denied</CardTitle>
              <CardDescription>
                You do not have permission to access organization settings.
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
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Organization Settings</h1>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Gmail Integration</CardTitle>
              <CardDescription>
                Connect your organization's Gmail account to enable email functionality.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label>Status</Label>
                  <p className="text-sm text-gray-500">
                    {organization?.gmail_refresh_token
                      ? 'Gmail is connected'
                      : 'Gmail is not connected'}
                  </p>
                </div>
                <Button
                  onClick={handleConnectGmail}
                  disabled={!!organization?.gmail_refresh_token}
                >
                  {organization?.gmail_refresh_token
                    ? 'Gmail Connected'
                    : 'Connect Gmail'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
} 