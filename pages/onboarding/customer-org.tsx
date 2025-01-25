import { Database } from '@/types/supabase'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

export default function CustomerOrgPage() {
  const router = useRouter()
  const supabase = useSupabaseClient<Database>()
  const [searchTerm, setSearchTerm] = useState('')
  const [orgs, setOrgs] = useState<{id:string, name:string, slug:string, avatar_url?: string}[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string|null>(null)

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const resp = await fetch('/api/tickets/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: selectedOrgId,
          subject: 'User Ticket Subject',
          description: question
        })
      })
      if (!resp.ok) {
        const er = await resp.json()
        throw new Error(er.error || 'Failed to create ticket')
      }
      router.push('/tickets')
    } catch (err:any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-xl font-semibold mb-4">Which organization do you have a question about?</h1>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <div className="text-red-500">{error}</div>}
        <div>
          <label className="block text-sm font-medium">Search organizations</label>
          <input
            className="mt-1 w-full border px-3 py-2"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Type org name..."
          />
        </div>
        <div className="space-y-1">
          {orgs.map(o => (
            <div key={o.id} className="flex items-center gap-2">
              <input
                type="radio"
                name="org"
                value={o.id}
                checked={selectedOrgId === o.id}
                onChange={() => setSelectedOrgId(o.id)}
              />
              <span>{o.name}</span>
            </div>
          ))}
        </div>
        <div>
          <label className="block text-sm font-medium">Describe your question</label>
          <textarea
            className="mt-1 w-full border px-3 py-2"
            value={question}
            onChange={e => setQuestion(e.target.value)}
          />
        </div>
        <button
          disabled={!selectedOrgId || !question || loading}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          {loading ? 'Submitting...' : 'Submit Ticket'}
        </button>
      </form>
    </div>
  )
} 