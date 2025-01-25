import { Database } from '@/types/supabase'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/router'
import { useState } from 'react'

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = useSupabaseClient<Database>()

  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<'customer' | 'agent' | 'admin'>('customer')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string|null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Validate display name
    if (!displayName.trim()) {
      setError('Please enter your name')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const resp = await fetch('/api/profiles/update-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName.trim(), role })
      })

      if (!resp.ok) {
        const e = await resp.json()
        throw new Error(e.error || 'Failed to update onboarding info')
      }

      // Route based on role
      if (role === 'customer') {
        // Customer flow: Organization Selection -> Submit Question -> Tickets
        router.push('/onboarding/customer/select-org')
      } else if (role === 'agent') {
        // Agent flow: Organization Selection/Creation -> Gmail (Optional) -> Dashboard
        router.push('/onboarding/agent/select-org')
      } else {
        // Admin flow: Organization Creation -> Gmail (Optional) -> Dashboard
        router.push('/onboarding/admin/create-org')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Complete Your Profile
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Tell us a bit about yourself to get started
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
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
                Your Name
              </label>
              <div className="mt-1">
                <input
                  id="name"
                  type="text"
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your full name"
                />
              </div>
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                Your Role
              </label>
              <div className="mt-1">
                <select
                  id="role"
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'customer'|'agent'|'admin')}
                >
                  <option value="customer">Customer - I need help with something</option>
                  <option value="agent">Agent - I provide customer support</option>
                  <option value="admin">Admin - I manage the organization</option>
                </select>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                    Setting up your profile...
                  </>
                ) : (
                  'Continue'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
} 