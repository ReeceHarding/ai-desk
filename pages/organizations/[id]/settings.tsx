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
    try {
      const response = await fetch('/api/gmail/auth-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'organization',
          id: organization?.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to get auth URL');
      }

      const { authUrl } = data;

      if (typeof window !== 'undefined') {
        window.location.href = authUrl;
      }
    } catch (error) {
      console.error('Error getting Gmail auth URL:', error);
    }
  };

  if (!organization || !isAdmin) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Organization Settings</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Gmail Integration</CardTitle>
          <CardDescription>
            Connect your organization&apos;s Gmail account to handle email communications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Gmail Connection Status</Label>
                <p className="text-sm text-gray-500">
                  {organization.gmail_refresh_token 
                    ? 'Connected to Gmail'
                    : 'Not connected to Gmail'}
                </p>
              </div>
              <Button
                onClick={handleConnectGmail}
                variant={organization.gmail_refresh_token ? "outline" : "default"}
              >
                {organization.gmail_refresh_token 
                  ? 'Reconnect Gmail'
                  : 'Connect Gmail'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 