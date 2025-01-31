import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

interface AgentPerformanceData {
  agent_id: string
  agent_name: string
  tickets_assigned: number
  tickets_resolved: number
  avg_response_time: string
  avg_resolution_time: string
}

interface AgentPerformanceTableProps {
  data: AgentPerformanceData[] | null
  loading?: boolean
}

export function AgentPerformanceTable({ data, loading = false }: AgentPerformanceTableProps) {
  if (loading) {
    return <AgentPerformanceTableSkeleton />
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agent Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            No agent performance data available
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead className="text-right">Assigned</TableHead>
              <TableHead className="text-right">Resolved</TableHead>
              <TableHead className="text-right">Avg Response</TableHead>
              <TableHead className="text-right">Avg Resolution</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((agent) => (
              <TableRow key={agent.agent_id}>
                <TableCell className="font-medium">{agent.agent_name}</TableCell>
                <TableCell className="text-right">{agent.tickets_assigned}</TableCell>
                <TableCell className="text-right">{agent.tickets_resolved}</TableCell>
                <TableCell className="text-right">{agent.avg_response_time}</TableCell>
                <TableCell className="text-right">{agent.avg_resolution_time}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function AgentPerformanceTableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-8 w-[200px]" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-[100px]" />
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              {Array.from({ length: 5 }).map((_, j) => (
                <Skeleton key={j} className="h-4 w-[100px]" />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
} 