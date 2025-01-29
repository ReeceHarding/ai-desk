import { ConnectionStatus } from '@/components/gmail/ConnectionStatus';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
        description: "Your organization's Gmail account has been successfully connected.",
        variant: "default",
      });
      // Remove query param
      router.replace(`/organizations/${id}/settings`, undefined, { shallow: true });
    } else if (router.query.error) {
      toast({
        title: "Connection Failed",
        description: router.query.message as string || "Failed to connect Gmail account. Please try again.",
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
      toast({
        title: "Error",
        description: "Failed to start Gmail connection process. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDisconnectGmail = async () => {
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          gmail_access_token: null,
          gmail_refresh_token: null,
          gmail_watch_status: null,
          gmail_watch_expiration: null,
          gmail_watch_resource_id: null
        })
        .eq('id', organization?.id);

      if (error) throw error;

      await fetchOrganization();
      
      toast({
        title: "Gmail Disconnected",
        description: "Your organization's Gmail account has been successfully disconnected.",
        variant: "default",
      });
    } catch (error) {
      console.error('Error disconnecting Gmail:', error);
      toast({
        title: "Disconnection Failed",
        description: "Failed to disconnect Gmail account. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (!organization || !isAdmin) {
    return (
      <AppLayout>
        <div>Loading...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-6">Organization Settings</h1>
        
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Gmail Integration</CardTitle>
            <CardDescription>
              Connect your organization's Gmail account to handle email communications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <ConnectionStatus orgId={organization.id} />
              <div className="flex items-center justify-end space-x-2">
                {organization.gmail_refresh_token ? (
                  <>
                    <Button
                      onClick={handleConnectGmail}
                      variant="outline"
                    >
                      Reconnect Gmail
                    </Button>
                    <Button
                      onClick={handleDisconnectGmail}
                      variant="destructive"
                    >
                      Disconnect Gmail
                    </Button>
                  </>
                ) : (
                  <Button onClick={handleConnectGmail}>
                    Connect Gmail
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
} 