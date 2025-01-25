import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { useOrganizationRole } from '@/hooks/useOrganizationRole';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';

interface Organization {
  id: string;
  name: string;
  logo_url?: string;
  description?: string;
  website?: string;
  timezone?: string;
  sla_tier?: string;
  public_mode?: boolean;
  gmail_refresh_token?: string;
  gmail_access_token?: string;
  gmail_watch_status?: string;
  gmail_watch_expiration?: string;
}

export default function OrganizationSettings() {
  const router = useRouter();
  const { id } = router.query;
  const supabase = useSupabaseClient();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const { role: orgRole, loading: roleLoading } = useOrganizationRole(id as string);
  const isAdmin = orgRole === 'admin' || orgRole === 'super_admin';
  const [origin, setOrigin] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const fetchOrganization = useCallback(async () => {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching organization:', error);
      setError('Error fetching organization. Please try again later.');
      setLoading(false);
      return;
    }

    setOrganization(data);
    setLoading(false);
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
      router.replace(`/organizations/${id}/settings`, undefined, { shallow: true });
    } else if (router.query.error) {
      toast({
        title: "Connection Failed",
        description: "Failed to connect Gmail account. Please try again.",
        variant: "destructive",
      });
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

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoFile(file);
  };

  const handleSave = async () => {
    if (!organization) return;

    setSaving(true);
    try {
      let logoUrl = organization.logo_url;

      // Upload new logo if selected
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const filePath = `${organization.id}/logo.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('organization-assets')
          .upload(filePath, logoFile, { upsert: true });

        if (uploadError) {
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('organization-assets')
          .getPublicUrl(filePath);

        logoUrl = publicUrl;
      }

      // Update organization
      const { error: updateError } = await supabase
        .from('organizations')
        .update({
          name: organization.name,
          description: organization.description,
          website: organization.website,
          timezone: organization.timezone,
          logo_url: logoUrl,
          public_mode: organization.public_mode,
          sla_tier: organization.sla_tier
        })
        .eq('id', organization.id);

      if (updateError) throw updateError;

      toast({
        title: 'Success',
        description: 'Organization settings updated successfully.',
        variant: 'default',
      });

      fetchOrganization();
    } catch (error) {
      console.error('Error saving organization:', error);
      toast({
        title: 'Error',
        description: 'Failed to update organization settings.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <span className="ml-2">Loading organization settings...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You do not have permission to access organization settings.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Organization Settings</h1>
        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Update your organization's basic information and branding.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Organization Name</Label>
                  <Input
                    value={organization?.name || ''}
                    onChange={(e) => setOrganization(prev => prev ? { ...prev, name: e.target.value } : null)}
                    placeholder="Enter organization name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={organization?.description || ''}
                    onChange={(e) => setOrganization(prev => prev ? { ...prev, description: e.target.value } : null)}
                    placeholder="Enter organization description"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input
                    value={organization?.website || ''}
                    onChange={(e) => setOrganization(prev => prev ? { ...prev, website: e.target.value } : null)}
                    placeholder="Enter organization website"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Logo</Label>
                  {organization?.logo_url && (
                    <div className="mb-2">
                      <Image
                        src={organization.logo_url}
                        alt="Organization logo"
                        width={100}
                        height={100}
                        className="rounded-lg"
                      />
                    </div>
                  )}
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Gmail Integration */}
          <Card>
            <CardHeader>
              <CardTitle>Gmail Integration</CardTitle>
              <CardDescription>
                Connect your organization's Gmail account to enable email functionality.
                When connected, new emails will automatically create tickets.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${organization?.gmail_refresh_token ? 'bg-green-500' : 'bg-red-500'}`} />
                    <p className="text-sm text-gray-500">
                      {organization?.gmail_refresh_token
                        ? 'Gmail is connected'
                        : 'Gmail is not connected'}
                    </p>
                  </div>
                  {organization?.gmail_watch_status && (
                    <div className="mt-2">
                      <Label>Watch Status</Label>
                      <p className="text-sm text-gray-500">
                        {organization.gmail_watch_status}
                        {organization.gmail_watch_expiration && (
                          <span className="ml-2">
                            (Expires: {new Date(organization.gmail_watch_expiration).toLocaleDateString()})
                          </span>
                        )}
                      </p>
                    </div>
                  )}
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

          {/* Advanced Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>
                Configure advanced settings for your organization.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Input
                    value={organization?.timezone || ''}
                    onChange={(e) => setOrganization(prev => prev ? { ...prev, timezone: e.target.value } : null)}
                    placeholder="Enter timezone (e.g., America/New_York)"
                  />
                </div>

                <div className="space-y-2">
                  <Label>SLA Tier</Label>
                  <select
                    value={organization?.sla_tier || 'standard'}
                    onChange={(e) => setOrganization(prev => prev ? { ...prev, sla_tier: e.target.value } : null)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  >
                    <option value="standard">Standard</option>
                    <option value="premium">Premium</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Public Mode</Label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={organization?.public_mode || false}
                      onChange={(e) => setOrganization(prev => prev ? { ...prev, public_mode: e.target.checked } : null)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-500">
                      Allow anyone to create tickets without an account
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 