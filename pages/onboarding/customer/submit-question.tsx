import { Database } from '@/types/supabase'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

export default function CustomerSubmitQuestionPage() {
  const router = useRouter()
  const supabase = useSupabaseClient<Database>()
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string|null>(null)
  const [organizationId, setOrganizationId] = useState<string|null>(null)

  useEffect(() => {
    async function getProfile() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/auth/signin')
        return
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', session.user.id)
        .single()

      if (error || !profile?.org_id) {
        setError('Failed to load organization. Please try again.')
        return
      }

      setOrganizationId(profile.org_id)
    }

    getProfile()
  }, [supabase, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (!organizationId) {
      setError('Organization not found. Please try again.')
      setLoading(false)
      return
    }

    try {
      const resp = await fetch('/api/tickets/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          description,
          organizationId
        })
      })

      if (!resp.ok) {
        const er = await resp.json()
        throw new Error(er.error || 'Failed to create ticket')
      }

      // Proceed to tickets page
      router.push('/tickets')
    } catch (err:any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Submit Your Question
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Describe what you need help with
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
              <label htmlFor="subject" className="block text-sm font-medium text-gray-700">
                Subject
              </label>
              <div className="mt-1">
                <input
                  id="subject"
                  type="text"
                  required
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief summary of your question"
                />
              </div>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <div className="mt-1">
                <textarea
                  id="description"
                  required
                  rows={4}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed description of what you need help with"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={!subject || !description || loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                    Submitting...
                  </>
                ) : (
                  'Submit Question'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
} 