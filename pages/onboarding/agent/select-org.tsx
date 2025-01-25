import { Database } from '@/types/supabase'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { Loader2, Mail } from 'lucide-react'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

export default function AgentSelectOrgPage() {
  const router = useRouter()
  const supabase = useSupabaseClient<Database>()
  const [searchTerm, setSearchTerm] = useState('')
  const [orgs, setOrgs] = useState<{id:string, name:string}[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [error, setError] = useState<string|null>(null)
  const [loading, setLoading] = useState(false)
  const [skipGmail, setSkipGmail] = useState(false)

  useEffect(() => {
    if (searchTerm.length < 1) {
      setOrgs([])
      return
    }
    const timer = setTimeout(() => {
      fetch(`/api/organizations/search?q=${encodeURIComponent(searchTerm)}`)
        .then(resp => resp.json())
        .then(data => setOrgs(data))
        .catch(e => console.error(e))
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  async function handleSelectOrg(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Join organization as agent
      const resp = await fetch('/api/organization-members/add-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ orgId: selectedOrgId })
      })
      if (!resp.ok) {
        const er = await resp.json()
        throw new Error(er.error || 'Failed to join organization')
      }

      if (skipGmail) {
        router.push('/dashboard')
        return
      }

      // Connect Gmail
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
            scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify'
          }
        }
      })

      if (error) throw error

      router.push('/dashboard')
    } catch(err:any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Select Your Organization
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Choose the organization you'll be supporting
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form onSubmit={handleSelectOrg} className="space-y-6">
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
              <label htmlFor="search" className="block text-sm font-medium text-gray-700">
                Search Organizations
              </label>
              <div className="mt-1">
                <input
                  id="search"
                  type="text"
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Search org name..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              {orgs.map(org => (
                <div key={org.id} className="flex items-center p-3 border rounded-lg hover:bg-gray-50">
                  <input
                    type="radio"
                    name="org"
                    id={org.id}
                    value={org.id}
                    checked={selectedOrgId === org.id}
                    onChange={() => setSelectedOrgId(org.id)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor={org.id} className="ml-3 block text-sm font-medium text-gray-700">
                    {org.name}
                  </label>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <button
                type="submit"
                disabled={!selectedOrgId || loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                    {skipGmail ? 'Joining...' : 'Connecting Gmail...'}
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Connect Gmail & Join
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setSkipGmail(true)}
                className="w-full text-sm text-gray-500 hover:text-gray-700"
              >
                Skip Gmail setup (you can connect later)
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
