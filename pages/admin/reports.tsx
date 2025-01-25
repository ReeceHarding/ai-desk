import { Database } from '@/types/supabase'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

type ReportData = {
  totalTickets: number
  openTickets: number
  solvedTickets: number
  averageResponseTime: number
  averageResolutionTime: number
  averageHappiness: number
  agentPerformance: {
    agentId: string
    agentName: string
    ticketsResolved: number
    averageResponseTime: number
    averageHappiness: number
  }[]
}

export default function AdminReportsPage() {
  const router = useRouter()
  const supabase = useSupabaseClient<Database>()
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|null>(null)
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'year'>('week')

  useEffect(() => {
    async function loadReportData() {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .single()

        if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
          router.push('/403')
          return
        }

        // Get basic ticket stats
        const { data: tickets, error: ticketsError } = await supabase
          .from('tickets')
          .select('*')
          .gte('created_at', getDateRangeStart(dateRange))

        if (ticketsError) throw ticketsError

        // Get agent performance data
        const { data: agents, error: agentsError } = await supabase
          .from('profiles')
          .select('*')
          .in('role', ['agent', 'admin'])

        if (agentsError) throw agentsError

        // Calculate report metrics
        const openTickets = tickets.filter(t => t.status === 'open').length
        const solvedTickets = tickets.filter(t => t.status === 'solved').length
        const totalTickets = tickets.length

        const agentPerformance = agents.map(agent => {
          const agentTickets = tickets.filter(t => t.assigned_agent_id === agent.id)
          const resolvedTickets = agentTickets.filter(t => t.status === 'solved')
          const happinessScores = resolvedTickets.map(t => t.happiness_score).filter(Boolean)
          
          return {
            agentId: agent.id,
            agentName: agent.display_name,
            ticketsResolved: resolvedTickets.length,
            averageResponseTime: agent.extra_json_1?.agentStats?.totalFirstResponseTime / agent.extra_json_1?.agentStats?.totalTicketsResponded || 0,
            averageHappiness: happinessScores.length ? happinessScores.reduce((a, b) => a + b, 0) / happinessScores.length : 0
          }
        })

        setReportData({
          totalTickets,
          openTickets,
          solvedTickets,
          averageResponseTime: tickets.reduce((acc, t) => acc + (t.first_response_time || 0), 0) / totalTickets,
          averageResolutionTime: tickets.reduce((acc, t) => acc + (t.resolution_time || 0), 0) / totalTickets,
          averageHappiness: tickets.filter(t => t.happiness_score).reduce((acc, t) => acc + (t.happiness_score || 0), 0) / tickets.filter(t => t.happiness_score).length,
          agentPerformance
        })
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadReportData()
  }, [router, supabase, dateRange])

  function getDateRangeStart(range: 'week' | 'month' | 'year'): string {
    const date = new Date()
    switch (range) {
      case 'week':
        date.setDate(date.getDate() - 7)
        break
      case 'month':
        date.setMonth(date.getMonth() - 1)
        break
      case 'year':
        date.setFullYear(date.getFullYear() - 1)
        break
    }
    return date.toISOString()
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <span className="ml-2">Loading reports...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold">Reports</h1>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as 'week' | 'month' | 'year')}
            className="border rounded px-3 py-1"
          >
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
            <option value="year">Last Year</option>
          </select>
        </div>

        {reportData && (
          <>
            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="text-lg font-medium mb-2">Ticket Overview</h3>
                <div className="space-y-2">
                  <p>Total Tickets: {reportData.totalTickets}</p>
                  <p>Open Tickets: {reportData.openTickets}</p>
                  <p>Solved Tickets: {reportData.solvedTickets}</p>
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="text-lg font-medium mb-2">Response Times</h3>
                <div className="space-y-2">
                  <p>Avg Response: {Math.round(reportData.averageResponseTime)} mins</p>
                  <p>Avg Resolution: {Math.round(reportData.averageResolutionTime)} mins</p>
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow">
                <h3 className="text-lg font-medium mb-2">Customer Satisfaction</h3>
                <p>Average Rating: {reportData.averageHappiness.toFixed(1)}/5</p>
              </div>
            </div>

            {/* Agent Performance */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <h3 className="text-lg font-medium p-4 border-b">Agent Performance</h3>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Agent
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tickets Resolved
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Avg Response Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer Satisfaction
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.agentPerformance.map(agent => (
                    <tr key={agent.agentId}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {agent.agentName}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {agent.ticketsResolved}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {Math.round(agent.averageResponseTime)} mins
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {agent.averageHappiness.toFixed(1)}/5
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
} 