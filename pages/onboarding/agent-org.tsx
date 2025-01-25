import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

export default function AgentOrgPage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [orgs, setOrgs] = useState<{id:string,name:string}[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [error, setError] = useState<string|null>(null)
  const [loading, setLoading] = useState(false)

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
      // Possibly call an API that updates user's membership to that org as an agent
      const resp = await fetch('/api/organization-members/add-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ orgId: selectedOrgId })
      })
      if (!resp.ok) {
        const er = await resp.json()
        throw new Error(er.error || 'Failed to join organization')
      }
      // Then route to connect gmail or directly to dashboard
      router.push('/profile/settings') // maybe user can connect Gmail from there
    } catch(err:any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-xl font-semibold mb-4">Select an Organization to represent</h1>
      <form onSubmit={handleSelectOrg} className="space-y-4">
        {error && <div className="text-red-500">{error}</div>}
        <div>
          <input
            className="w-full border px-3 py-2"
            placeholder="Search org name..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        {orgs.map(org => (
          <div key={org.id} className="flex items-center gap-2">
            <input
              type="radio"
              name="org"
              value={org.id}
              checked={selectedOrgId === org.id}
              onChange={() => setSelectedOrgId(org.id)}
            />
            <span>{org.name}</span>
          </div>
        ))}
        <button
          type="submit"
          disabled={!selectedOrgId || loading}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          {loading ? 'Joining...' : 'Join Org'}
        </button>
      </form>
    </div>
  )
} 