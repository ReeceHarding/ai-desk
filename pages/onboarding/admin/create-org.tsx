import { Database } from '@/types/supabase'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { Loader2, Upload } from 'lucide-react'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

export default function AdminCreateOrgPage() {
  const router = useRouter()
  const supabase = useSupabaseClient<Database>()
  const [orgName, setOrgName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [error, setError] = useState<string|null>(null)
  const [loading, setLoading] = useState(false)

  // Log initial mount
  useEffect(() => {
    console.log('[CREATE-ORG] Component mounted');
    // Check for any existing pending org data
    const pendingOrgId = localStorage.getItem('pendingOrgId');
    if (pendingOrgId) {
      console.log('[CREATE-ORG] Found pending org data, clearing...', { pendingOrgId });
      localStorage.removeItem('pendingOrgId');
      localStorage.removeItem('pendingOrgName');
      localStorage.removeItem('pendingOrgCreatedAt');
    }
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    console.log('[CREATE-ORG] Starting organization creation', { orgName, avatarUrl });
    
    setLoading(true)
    setError(null)
    
    try {
      // Verify user session first
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        console.error('[CREATE-ORG] No user session found');
        throw new Error('Please sign in to create an organization');
      }
      console.log('[CREATE-ORG] User session verified', { userId: session.user.id });

      // Create organization
      console.log('[CREATE-ORG] Creating organization...');
      const resp = await fetch('/api/organizations/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ name: orgName, avatar_url: avatarUrl })
      })
      
      if (!resp.ok) {
        const er = await resp.json()
        console.error('[CREATE-ORG] Failed to create organization', er);
        throw new Error(er.error || 'Failed to create org')
      }

      const { organization } = await resp.json()
      console.log('[CREATE-ORG] Organization created successfully', { 
        orgId: organization.id,
        orgName: organization.name,
        slug: organization.slug 
      });

      // Redirect to Gmail connection page
      console.log('[CREATE-ORG] Redirecting to Gmail connection page');
      router.push('/onboarding/admin/connect-gmail');
    } catch(err:any) {
      console.error('[CREATE-ORG] Error in handleCreate:', err);
      setError(err.message)
      setLoading(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      console.log('[CREATE-ORG] No file selected for avatar upload');
      return;
    }

    console.log('[CREATE-ORG] Starting avatar upload', { 
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type 
    });

    try {
      setLoading(true)
      const formData = new FormData()
      formData.append('file', file)

      const resp = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (!resp.ok) {
        console.error('[CREATE-ORG] Avatar upload failed', await resp.json());
        throw new Error('Failed to upload avatar')
      }

      const { url } = await resp.json()
      console.log('[CREATE-ORG] Avatar uploaded successfully', { url });
      setAvatarUrl(url)
    } catch (err: any) {
      console.error('[CREATE-ORG] Error uploading avatar:', err);
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Create Your Organization
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Set up your support organization
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form onSubmit={handleCreate} className="space-y-6">
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      {error}
                    </h3>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Organization Name
              </label>
              <div className="mt-1">
                <input
                  id="name"
                  type="text"
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  placeholder="Enter organization name"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Organization Logo
              </label>
              <div className="mt-1 flex items-center space-x-4">
                {avatarUrl && (
                  <img
                    src={avatarUrl}
                    alt="Organization logo"
                    className="h-12 w-12 rounded-full object-cover"
                  />
                )}
                <label htmlFor="avatar-upload" className="cursor-pointer">
                  <div className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                    <Upload className="h-4 w-4" />
                    Upload Logo
                  </div>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={!orgName || loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Creating Organization...
                </>
              ) : (
                'Create Organization'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
} 