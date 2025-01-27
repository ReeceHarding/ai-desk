import NotificationPreferences from '@/components/notification-preferences';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Database } from '@/types/supabase';
import { getGmailProfile } from '@/utils/gmail';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';

type UserRole = Database['public']['Enums']['user_role'];

interface Profile {
  id: string;
  email: string;
  role: UserRole;
  gmail_access_token?: string | null;
  gmail_refresh_token?: string | null;
  org_id: string;
}

export default function ProfileSettings() {
  const supabase = useSupabaseClient<Database>();
  const user = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const { success, error } = router.query;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [gmailAddress, setGmailAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [origin, setOrigin] = useState<string>('');

  const fetchProfile = useCallback(async () => {
    try {
      if (!user?.id) {
        console.log('No user ID available yet');
        return;
      }

      console.log('Fetching profile for user:', user.id);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        toast({
          title: "Error",
          description: "Failed to load profile data. Please try refreshing the page.",
          variant: "destructive",
        });
        return;
      }

      console.log('Profile data loaded:', data);
      setProfile(data);
    } catch (err) {
      console.error('Unexpected error fetching profile:', err);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, user?.id, toast]);

  const fetchGmailProfile = useCallback(async () => {
    try {
      if (!profile?.gmail_refresh_token || !profile?.gmail_access_token || !user?.id) {
        setGmailAddress(null);
        return;
      }

      const gmailProfile = await getGmailProfile({
        refresh_token: profile.gmail_refresh_token,
        access_token: profile.gmail_access_token,
        user_id: user.id
      });
      setGmailAddress(gmailProfile.emailAddress);
    } catch (error) {
      console.error('Error fetching Gmail profile:', error);
      setGmailAddress(null);
    }
  }, [profile?.gmail_refresh_token, profile?.gmail_access_token, user?.id]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    if (success) {
      toast({
        title: 'Success',
        description: 'Gmail connected successfully',
      });
      router.replace('/profile/settings');
    }
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to connect Gmail',
        variant: 'destructive',
      });
      router.replace('/profile/settings');
    }
  }, [success, error, router, toast]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const handleConnectGmail = async () => {
    try {
      if (!user || !profile?.org_id) {
        toast({
          title: 'Error',
          description: 'Missing user or organization ID',
          variant: 'destructive',
        });
        return;
      }

      const response = await fetch('/api/gmail/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          org_id: profile.org_id
        })
      });

      if (!response.ok) {
        throw new Error('Failed to initiate Gmail connection');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Error connecting Gmail:', error);
      toast({
        title: 'Error',
        description: 'Failed to connect Gmail',
        variant: 'destructive',
      });
    }
  };

  const handleDisconnectGmail = async () => {
    try {
      if (!user || !profile?.org_id) {
        toast({
          title: 'Error',
          description: 'Missing user or organization ID',
          variant: 'destructive',
        });
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          gmail_access_token: null,
          gmail_refresh_token: null,
          gmail_watch_status: null,
          gmail_watch_expiration: null
        })
        .eq('id', user.id);

      if (error) throw error;

      setGmailAddress(null);
      toast({
        title: 'Success',
        description: 'Gmail disconnected successfully',
      });
    } catch (error) {
      console.error('Error disconnecting Gmail:', error);
      toast({
        title: 'Error',
        description: 'Failed to disconnect Gmail',
        variant: 'destructive',
      });
    }
  };

  const handleRoleChange = async (newRole: UserRole) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', user?.id);

      if (error) throw error;

      await fetchProfile();
      
      toast({
        title: "Role Updated",
        description: `Your role has been updated to ${newRole}`,
        variant: "default",
      });

      // Force a page reload to update all components using the role
      window.location.reload();
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update role. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <span className="ml-2">Loading profile...</span>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Profile Not Found</h2>
          <p className="text-gray-600">Unable to load your profile data. Please try refreshing the page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold mb-6">Profile Settings</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Role Settings</CardTitle>
          <CardDescription>
            Manage your user role
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <Label htmlFor="role">Role</Label>
              <Select
                value={profile?.role || 'customer'}
                onValueChange={(value: UserRole) => handleRoleChange(value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

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
                    ? `Connected to Gmail${gmailAddress ? ` (${gmailAddress})` : ''}`
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

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Notification Settings</CardTitle>
          <CardDescription>
            Manage how you want to be notified about ticket updates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationPreferences userId={user?.id || ''} orgId={profile?.org_id || ''} />
        </CardContent>
      </Card>
    </div>
  );
} 