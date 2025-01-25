import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { Loader2, Upload } from 'lucide-react';
import { useState } from 'react';

interface AdminOnboardingProps {
  userId: string;
  email: string;
  name: string;
  onComplete: (orgName: string) => void;
}

export function AdminOnboarding({ userId, email, name, onComplete }: AdminOnboardingProps) {
  const [orgName, setOrgName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const supabase = useSupabaseClient();

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setIsUploading(true);
      setError('');

      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image must be less than 5MB');
        return;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setAvatarUrl(publicUrl);
    } catch (err) {
      console.error('Error uploading avatar:', err);
      setError('Failed to upload avatar. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleComplete = async () => {
    try {
      if (!orgName.trim()) {
        setError('Please enter your organization name');
        return;
      }

      setIsLoading(true);
      setError('');

      // Update profile with avatar and role
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          avatar_url: avatarUrl,
          role: 'admin'
        })
        .eq('id', userId);

      if (updateError) throw updateError;

      onComplete(orgName);
    } catch (err) {
      console.error('Error completing setup:', err);
      setError('Failed to complete setup. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const canProceed = orgName.trim() && avatarUrl;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Set Up Your Organization</h2>
        <p className="mt-1 text-sm text-gray-500">
          Let's get your support team set up with Gauntlet.
        </p>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="orgName" className="block text-sm font-medium text-gray-700">
            Organization Name
          </label>
          <Input
            id="orgName"
            type="text"
            required
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            className="mt-1"
            placeholder="Enter your organization name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Profile Picture
          </label>
          <div className="mt-1 flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback>
                {name ? name[0].toUpperCase() : 'A'}
              </AvatarFallback>
            </Avatar>
            <div>
              <label htmlFor="avatar-upload" className="cursor-pointer">
                <div className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                  <Upload className="h-4 w-4" />
                  {isUploading ? 'Uploading...' : 'Upload Picture'}
                </div>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="sr-only"
                  disabled={isUploading}
                />
              </label>
              <p className="mt-1 text-xs text-gray-500">
                JPG, PNG or GIF (max. 5MB)
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={handleComplete}
          disabled={!canProceed || isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Setting up...
            </>
          ) : (
            'Complete Setup'
          )}
        </Button>
      </div>
    </div>
  );
} 