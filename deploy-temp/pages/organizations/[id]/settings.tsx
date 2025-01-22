import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from '@/components/ui/use-toast';

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
      // Construct OAuth URL
      const clientId = process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID;
      const redirectUri = encodeURIComponent(process.env.NEXT_PUBLIC_GMAIL_REDIRECT_URI || '');
      const scope = encodeURIComponent('https://www.googleapis.com/auth/gmail.modify');
      
      console.log('Gmail OAuth configuration:', {
        clientId,
        redirectUri: process.env.NEXT_PUBLIC_GMAIL_REDIRECT_URI,
        scope: 'https://www.googleapis.com/auth/gmail.modify',
        state: `org:${id}`,
      });
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=org:${id}`;
      
      console.log('Redirecting to:', authUrl);
      // Redirect to Google OAuth
      window.location.href = authUrl;
    } catch (error) {
      console.error('Error initiating Gmail connection:', error);
      toast({
        title: "Connection Failed",
        description: "Failed to initiate Gmail connection. Please try again.",
        variant: "destructive",
      });
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