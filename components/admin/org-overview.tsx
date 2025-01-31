import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts"

interface OrgPerformanceData {
  total_tickets: number
  open_tickets: number
  solved_tickets: number
  avg_response_time: string
  avg_resolution_time: string
  sla_compliance_rate: number
  customer_satisfaction_rate: number
  tickets_by_priority: Record<string, number>
  tickets_by_status: Record<string, number>
  daily_ticket_stats: Array<{
    date: string
    new_tickets: number
    resolved_tickets: number
  }>
}

interface OrgOverviewProps {
  data: OrgPerformanceData | null
  loading?: boolean
}

export function OrgOverview({ data, loading = false }: OrgOverviewProps) {
  if (loading) {
    return <OrgOverviewSkeleton />
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Organization Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            No organization data available
          </div>
        </CardContent>
      </Card>
    )
  }

  const ticketTrends = data.daily_ticket_stats.map((stat) => ({
    date: new Date(stat.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    "New Tickets": stat.new_tickets,
    "Resolved Tickets": stat.resolved_tickets,
  }))

  const priorityData = Object.entries(data.tickets_by_priority).map(([priority, count]) => ({
    name: priority.charAt(0).toUpperCase() + priority.slice(1),
    value: count,
  }))

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <QuickStat
          title="Total Tickets"
          value={data.total_tickets}
          description="All-time tickets"
        />
        <QuickStat
          title="Open Tickets"
          value={data.open_tickets}
          description="Currently active"
        />
        <QuickStat
          title="SLA Compliance"
          value={`${data.sla_compliance_rate.toFixed(1)}%`}
          description="Meeting SLA targets"
        />
        <QuickStat
          title="CSAT Rate"
          value={`${data.customer_satisfaction_rate.toFixed(1)}%`}
          description="Customer satisfaction"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ticket Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ticketTrends}>
                  <defs>
                    <linearGradient id="newTickets" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="resolvedTickets" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16a34a" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" />
                  <YAxis />
                  <CartesianGrid strokeDasharray="3 3" />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="New Tickets"
                    stroke="#2563eb"
                    fillOpacity={1}
                    fill="url(#newTickets)"
                  />
                  <Area
                    type="monotone"
                    dataKey="Resolved Tickets"
                    stroke="#16a34a"
                    fillOpacity={1}
                    fill="url(#resolvedTickets)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tickets by Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <CartesianGrid strokeDasharray="3 3" />
                  <Tooltip />
                  <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

interface QuickStatProps {
  title: string
  value: string | number
  description: string
}

function QuickStat({ title, value, description }: QuickStatProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function OrgOverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-[100px]" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-[60px] mb-2" />
              <Skeleton className="h-3 w-[140px]" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-[140px] mb-2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
} 