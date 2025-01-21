import { useEffect, useState } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

export default function ProfileSettings() {
  const supabase = useSupabaseClient();
  const user = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  useEffect(() => {
    // Check for success/error query params
    if (router.query.success) {
      toast({
        title: "Gmail Connected",
        description: "Your Gmail account has been successfully connected.",
        variant: "default",
      });
      // Remove query params
      router.replace('/profile/settings', undefined, { shallow: true });
    } else if (router.query.error) {
      toast({
        title: "Connection Failed",
        description: router.query.message as string || "Failed to connect Gmail account. Please try again.",
        variant: "destructive",
      });
      // Remove query params
      router.replace('/profile/settings', undefined, { shallow: true });
    }
  }, [router.query, toast]);

  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user?.id)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return;
    }

    setProfile(data);
  };

  const handleConnectGmail = async () => {
    // Construct OAuth URL
    const clientId = process.env.NEXT_PUBLIC_GMAIL_CLIENT_ID;
    const redirectUri = encodeURIComponent(process.env.NEXT_PUBLIC_GMAIL_REDIRECT_URI || '');
    const scopes = [
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly'
    ];
    const scope = encodeURIComponent(scopes.join(' '));
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=profile:${user?.id}`;
    
    // Redirect to Google OAuth
    window.location.href = authUrl;
  };

  const handleDisconnectGmail = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          gmail_access_token: null,
          gmail_refresh_token: null
        })
        .eq('id', user?.id);

      if (error) throw error;

      await fetchProfile();
      
      toast({
        title: "Gmail Disconnected",
        description: "Your Gmail account has been successfully disconnected.",
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

  if (!profile) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Profile Settings</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Personal Gmail Integration</CardTitle>
          <CardDescription>
            Connect your personal Gmail account to handle email communications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Gmail Connection Status</Label>
                <p className="text-sm text-gray-500">
                  {profile.gmail_refresh_token 
                    ? 'Connected to Gmail'
                    : 'Not connected to Gmail'}
                </p>
              </div>
              {profile.gmail_refresh_token ? (
                <div className="space-x-2">
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
                </div>
              ) : (
                <Button
                  onClick={handleConnectGmail}
                  variant="default"
                >
                  Connect Gmail
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 