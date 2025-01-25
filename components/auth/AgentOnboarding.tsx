import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { Loader2, Mail, Upload } from 'lucide-react';
import { useState } from 'react';
import { OrganizationSearch } from './OrganizationSearch';

interface AgentOnboardingProps {
  userId: string;
  email: string;
  onComplete: () => void;
}

type AgentOnboardingStep = 'profile' | 'gmail' | 'organization';

export function AgentOnboarding({ userId, email, onComplete }: AgentOnboardingProps) {
  const [step, setStep] = useState<AgentOnboardingStep>('profile');
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [skipGmail, setSkipGmail] = useState(false);
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

  const handleProfileComplete = async () => {
    try {
      if (!name.trim()) {
        setError('Please enter your name');
        return;
      }

      setIsLoading(true);
      setError('');

      // Update profile with name and avatar
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          display_name: name,
          avatar_url: avatarUrl,
          role: 'agent'
        })
        .eq('id', userId);

      if (updateError) throw updateError;

      setStep('gmail');
    } catch (err) {
      console.error('Error during profile setup:', err);
      setError('Failed to complete profile setup. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGmailConnect = async () => {
    try {
      setIsLoading(true);
      setError('');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
            scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify'
          }
        }
      });

      if (error) throw error;

      setStep('organization');
    } catch (err) {
      console.error('Error connecting Gmail:', err);
      setError('Failed to connect Gmail. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipGmail = () => {
    setSkipGmail(true);
    setStep('organization');
  };

  const handleOrganizationSelect = async (orgId: string) => {
    try {
      setIsLoading(true);
      setError('');

      // Update agent's organization
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ organization_id: orgId })
        .eq('id', userId);

      if (updateError) throw updateError;

      onComplete();
    } catch (err) {
      console.error('Error selecting organization:', err);
      setError('Failed to join organization. Please try again.');
      setIsLoading(false);
    }
  };

  const canProceed = name.trim() && (avatarUrl || step !== 'profile');

  if (step === 'organization') {
    return (
      <div className="space-y-6">
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
            {error}
          </div>
        )}
        <OrganizationSearch
          userId={userId}
          onSelect={handleOrganizationSelect}
          isLoading={isLoading}
        />
      </div>
    );
  }

  if (step === 'gmail') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Connect Gmail</h2>
          <p className="mt-1 text-sm text-gray-500">
            Connect your Gmail account to handle customer support emails directly from the platform.
          </p>
        </div>

        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <Button
            onClick={handleGmailConnect}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Connect Gmail Account
              </>
            )}
          </Button>

          <button
            onClick={handleSkipGmail}
            className="w-full text-sm text-gray-500 hover:text-gray-700"
          >
            Skip for now (you can connect Gmail later)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Complete Your Agent Profile</h2>
        <p className="mt-1 text-sm text-gray-500">
          Please provide your details to get started as a support agent.
        </p>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Full Name
          </label>
          <Input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1"
            placeholder="Enter your full name"
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
          onClick={handleProfileComplete}
          disabled={!canProceed || isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving Profile...
            </>
          ) : (
            'Continue'
          )}
        </Button>
      </div>
    </div>
  );
} 