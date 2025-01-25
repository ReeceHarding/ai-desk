import AppLayout from '@/components/layout/AppLayout'
import { Database } from '@/types/supabase'
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

export default function NewTicketPage() {
  const router = useRouter()
  const { id } = router.query // Now using organization ID instead of slug
  const user = useUser()
  const supabase = useSupabaseClient<Database>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string|null>(null)
  const [formData, setFormData] = useState({
    subject: '',
    description: ''
  })

  useEffect(() => {
    if (!user) {
      router.push('/auth/signin')
    }
  }, [user, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .insert([{
          subject: formData.subject,
          description: formData.description,
          status: 'open',
          priority: 'medium',
          customer_id: user!.id,
          org_id: id as string
        }])
        .select()
        .single()

      if (ticketError) throw ticketError

      router.push('/tickets')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">New Ticket</h1>
          <button
            onClick={() => router.push('/tickets')}
            className="text-blue-600 hover:underline"
          >
            ← Back to Tickets
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-500 p-4 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="subject"
              className="block text-sm font-medium text-gray-700"
            >
              Subject
            </label>
            <input
              type="text"
              id="subject"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700"
            >
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={5}
              value={formData.description}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Ticket'}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  )
} 