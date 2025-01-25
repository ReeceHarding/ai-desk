import { useRouter } from 'next/router'
import { useState } from 'react'

export default function CreateOrgPage() {
  const router = useRouter()
  const [orgName, setOrgName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [error, setError] = useState<string|null>(null)
  const [loading, setLoading] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch('/api/organizations/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ name: orgName, avatar_url: avatarUrl })
      })
      if (!resp.ok) {
        const er = await resp.json()
        throw new Error(er.error || 'Failed to create org')
      }
      router.push('/profile/settings') // next step: connect Gmail
    } catch(err:any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-xl font-semibold mb-4">Create New Organization</h1>
      {error && <div className="text-red-500 mb-2">{error}</div>}
      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Organization Name</label>
          <input
            className="w-full border px-3 py-2 mt-1"
            value={orgName}
            onChange={e => setOrgName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Logo / Avatar URL (optional)</label>
          <input
            className="w-full border px-3 py-2 mt-1"
            value={avatarUrl}
            onChange={e => setAvatarUrl(e.target.value)}
          />
        </div>
        <button
          disabled={!orgName || loading}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          {loading ? 'Creating...' : 'Create Organization'}
        </button>
      </form>
    </div>
  )
} 