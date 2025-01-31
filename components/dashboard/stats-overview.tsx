import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardStats } from '@/utils/dashboardStats'
import {
    AlertTriangle,
    Clock,
    Mail,
    MessageSquare,
    Ticket,
    Users
} from 'lucide-react'
import {
    Bar,
    BarChart,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'

interface StatsOverviewProps {
  stats: DashboardStats | null
  loading?: boolean
}

export function StatsOverview({ stats, loading = false }: StatsOverviewProps) {
  if (loading) {
    return <StatsOverviewSkeleton />
  }

  if (!stats) {
    return null
  }

  return (
    <div className="space-y-8">
      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <QuickStatCard
          title="Open Tickets"
          value={stats.ticketStats.open}
          description="Active tickets requiring attention"
          icon={<Ticket className="h-4 w-4 text-blue-500" />}
        />
        <QuickStatCard
          title="High Priority"
          value={stats.ticketStats.highPriority}
          description="Urgent tickets needing immediate action"
          icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
        />
        <QuickStatCard
          title="Avg Response"
          value={`${stats.ticketStats.avgResponseHours}h`}
          description="Average ticket response time"
          icon={<Clock className="h-4 w-4 text-orange-500" />}
        />
        <QuickStatCard
          title="Active Agents"
          value={stats.userStats.totalAgents}
          description="Team members handling tickets"
          icon={<Users className="h-4 w-4 text-green-500" />}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Response Time Trend</CardTitle>
            <CardDescription>Average response time over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.ticketStats.responseTimeHistory}>
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    tick={{ fontSize: 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `${value}h`}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`${value}h`, 'Response Time']}
                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                  />
                  <Line
                    type="monotone"
                    dataKey="hours"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email Activity</CardTitle>
            <CardDescription>Email volume over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.emailStats.emailsOverTime}>
                  <XAxis 
                    dataKey="date"
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    tick={{ fontSize: 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number) => [value, 'Emails']}
                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                  />
                  <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Ticket Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Ticket Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2">
              {Object.entries(stats.ticketStats.byStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <dt className="text-sm font-medium capitalize text-muted-foreground">{status}</dt>
                  <dd className="text-sm font-medium">{count}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        {/* Email Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2">
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-muted-foreground">Total Emails</dt>
                <dd className="text-sm font-medium">{stats.emailStats.totalEmails}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-muted-foreground">Inbound</dt>
                <dd className="text-sm font-medium">{stats.emailStats.inboundCount}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-muted-foreground">Outbound</dt>
                <dd className="text-sm font-medium">{stats.emailStats.outboundCount}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm font-medium text-muted-foreground">Avg Response Time</dt>
                <dd className="text-sm font-medium">{stats.emailStats.averageResponseTime}h</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Agent Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Agent Workload
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2">
              {stats.userStats.activeAgents.map((agent) => (
                <div key={agent.id} className="flex items-center justify-between">
                  <dt className="text-sm font-medium text-muted-foreground">{agent.name}</dt>
                  <dd className="text-sm font-medium">{agent.openTickets} tickets</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function QuickStatCard({ 
  title, 
  value, 
  description, 
  icon 
}: { 
  title: string
  value: number | string
  description: string
  icon: React.ReactNode 
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">
          {description}
        </p>
      </CardContent>
    </Card>
  )
}

function StatsOverviewSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-[60px] mb-2" />
              <Skeleton className="h-3 w-[140px]" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-[140px] mb-2" />
              <Skeleton className="h-4 w-[200px]" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[200px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-[120px]" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-[100px]" />
                    <Skeleton className="h-4 w-[40px]" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
} 