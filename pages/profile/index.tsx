import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Image from 'next/image';
import { useRouter } from 'next/router';
import React, { useEffect, useRef, useState } from 'react';
import AppLayout from '../../components/layout/AppLayout';
import { Button } from '../../components/ui/button';
import { useThreadPanel } from '../../contexts/ThreadPanelContext';

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isThreadPanelOpen } = useThreadPanel();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('');
  const [_isAdmin, setIsAdmin] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const fetchProfile = async (userId: string) => {
    try {
      console.log('Fetching profile for user:', userId);
      
      // First check if user exists in auth
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error('Auth check error:', authError);
        setError('Failed to verify authentication');
        setDebugInfo({ type: 'auth_error', error: authError });
        return;
      }
      console.log('Auth check successful:', authData);

      // Then check if profile exists
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('Profile fetch error:', profileError);
        setError('Failed to fetch profile');
        setDebugInfo({ type: 'profile_error', error: profileError, userId });
        return;
      }
      console.log('Profile data:', profileData);

      if (!profileData) {
        console.log('No profile found, checking organizations...');
        // Check if default organization exists
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('*')
          .eq('name', 'Default Organization')
          .single();

        if (orgError) {
          console.error('Organization check error:', orgError);
          setDebugInfo({ type: 'org_error', error: orgError });
        } else {
          console.log('Default organization:', orgData);
          setDebugInfo({ type: 'org_found', org: orgData });
        }

        setError('Profile not found. Please contact support.');
        return;
      }

      setDisplayName(profileData.display_name || '');
      setPhone(profileData.phone || '');
      setAvatarUrl(profileData.avatar_url || '');
      setEmail(profileData.email || '');
      setRole(profileData.role || '');
      
    } catch (err) {
      console.error('Profile fetch error:', err);
      setError('Failed to fetch profile');
      setDebugInfo({ type: 'unknown_error', error: err });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/auth/signin');
          return;
        }

        await fetchProfile(user.id);
      } catch (error) {
        console.error('Error:', error);
        router.push('/auth/signin');
      }
    };

    getUser();
  }, [router, supabase.auth]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      // Only check if it's an image
      if (!file.type.startsWith('image/')) {
        throw new Error('Please upload an image file');
      }

      setIsUploading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        throw new Error('No user ID found');
      }

      // Create a unique file path
      const fileExt = file.name.split('.').pop();
      const filePath = `${session.user.id}/${Date.now()}.${fileExt}`;

      // Upload the file
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', session.user.id);

      if (updateError) throw updateError;

      // Update local state
      setAvatarUrl(publicUrl);
    } catch (err) {
      console.error('Avatar upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload avatar');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        throw new Error('No user ID found');
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          phone,
          avatar_url: avatarUrl,
          role: role,
        })
        .eq('id', session.user.id);

      if (error) throw error;
      
      // Refetch to confirm changes
      await fetchProfile(session.user.id);
    } catch (err) {
      console.error('Profile update error:', err);
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className={`transition-all duration-300 mx-auto p-2 ${isThreadPanelOpen ? 'max-w-xl' : 'max-w-2xl'}`}>
          <div className="text-center">Loading profile...</div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className={`transition-all duration-300 mx-auto p-2 ${isThreadPanelOpen ? 'max-w-xl' : 'max-w-2xl'}`}>
          <div className="bg-red-50 text-red-500 p-4 rounded-md space-y-2">
            <div className="font-medium">Error: {error}</div>
            {debugInfo && (
              <div className="text-sm bg-red-100 p-2 rounded">
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className={`transition-all duration-300 mx-auto ${isThreadPanelOpen ? 'max-w-xl p-2' : 'max-w-2xl p-4'}`}>
        <h1 className="text-xl font-bold mb-3">My Profile</h1>
        
        {error && (
          <div className="bg-red-50 text-red-500 p-2 rounded-md text-sm mb-3">
            {error}
          </div>
        )}

        <form onSubmit={handleUpdateProfile} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                disabled
                className="mt-1 w-full border rounded-md px-2 py-1.5 bg-gray-50 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium" htmlFor="displayName">
                Display Name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1 w-full border rounded-md px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium" htmlFor="phone">
                Phone
              </label>
              <input
                id="phone"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full border rounded-md px-2 py-1.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium" htmlFor="role">
                Role
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1 w-full border rounded-md px-2 py-1.5 text-sm"
              >
                <option value="customer">Customer</option>
                <option value="agent">Agent</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
          </div>

          <div className="flex items-start space-x-3 py-2">
            <div className="relative w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt="Profile avatar"
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
            </div>
            <div className="flex-grow">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                id="avatar-upload"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {isUploading ? 'Uploading...' : 'Change Avatar'}
              </button>
              <p className="mt-1 text-xs text-gray-500">
                JPG, PNG or GIF (max. 2MB)
              </p>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <Button
              type="submit"
              className="bg-blue-600 text-white px-3 py-1.5 text-sm rounded-md hover:bg-blue-700"
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>

            <Button
              onClick={async () => {
                await supabase.auth.signOut();
                router.push('/auth/signin');
              }}
              className="bg-red-600 text-white px-3 py-1.5 text-sm rounded-md hover:bg-red-700"
            >
              Sign Out
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
} 