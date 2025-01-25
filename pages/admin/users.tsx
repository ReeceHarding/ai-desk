import AppLayout from '@/components/layout/AppLayout'
import { Database } from '@/types/supabase'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

type UserWithProfile = {
  id: string
  email: string
  role: string
  display_name: string
  created_at: string
  agentStats?: {
    totalTicketsResponded: number
    totalFirstResponseTime: number
    totalTicketsResolved: number
    totalResolutionTime: number
    averageHappiness: number
  }
}

export default function AdminUsersPage() {
  const router = useRouter()
  const supabase = useSupabaseClient<Database>()
  const [users, setUsers] = useState<UserWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|null>(null)

  useEffect(() => {
    async function loadUsers() {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .single()

        if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
          router.push('/403')
          return
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error

        setUsers(data.map(user => ({
          ...user,
          agentStats: user.extra_json_1?.agentStats
        })))
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadUsers()
  }, [router, supabase])

  async function handleRoleChange(userId: string, newRole: string) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) throw error

      setUsers(users.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ))
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6">Loading users...</div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-6">User Management</h1>
        
        {error && (
          <div className="bg-red-50 text-red-500 p-4 rounded mb-4">
            {error}
          </div>
        )}

        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tickets Handled
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Response Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Happiness
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map(user => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {user.display_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      className="text-sm border rounded px-2 py-1"
                    >
                      <option value="customer">Customer</option>
                      <option value="agent">Agent</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.agentStats?.totalTicketsResolved || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.agentStats?.totalFirstResponseTime && user.agentStats?.totalTicketsResponded
                      ? Math.round(user.agentStats.totalFirstResponseTime / user.agentStats.totalTicketsResponded) + ' mins'
                      : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.agentStats?.averageHappiness
                      ? user.agentStats.averageHappiness.toFixed(1)
                      : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  )
} 