import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { AlertCircle, CheckCircle, Clock, Users } from "lucide-react"

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
      <Card className="bg-white/10 backdrop-blur-lg border-slate-200/20">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-slate-900">Agent Performance</CardTitle>
          <CardDescription>Track individual agent metrics and performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-slate-500">
            No agent performance data available
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-white/10 backdrop-blur-lg border-slate-200/20">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-slate-900">Agent Performance</CardTitle>
        <CardDescription>Track individual agent metrics and performance</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-slate-500" />
                  <span>Agent</span>
                </div>
              </TableHead>
              <TableHead className="text-right">
                <div className="flex items-center justify-end space-x-2">
                  <AlertCircle className="h-4 w-4 text-blue-500" />
                  <span>Assigned</span>
                </div>
              </TableHead>
              <TableHead className="text-right">
                <div className="flex items-center justify-end space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Resolved</span>
                </div>
              </TableHead>
              <TableHead className="text-right">
                <div className="flex items-center justify-end space-x-2">
                  <Clock className="h-4 w-4 text-orange-500" />
                  <span>Avg Response</span>
                </div>
              </TableHead>
              <TableHead className="text-right">
                <div className="flex items-center justify-end space-x-2">
                  <Clock className="h-4 w-4 text-purple-500" />
                  <span>Avg Resolution</span>
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((agent) => (
              <TableRow key={agent.agent_id}>
                <TableCell className="font-medium text-slate-900">{agent.agent_name}</TableCell>
                <TableCell className="text-right font-medium text-blue-600">{agent.tickets_assigned}</TableCell>
                <TableCell className="text-right font-medium text-green-600">{agent.tickets_resolved}</TableCell>
                <TableCell className="text-right font-medium text-orange-600">{agent.avg_response_time}</TableCell>
                <TableCell className="text-right font-medium text-purple-600">{agent.avg_resolution_time}</TableCell>
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
    <Card className="bg-white/10 backdrop-blur-lg border-slate-200/20">
      <CardHeader>
        <Skeleton className="h-7 w-[250px]" />
        <Skeleton className="h-4 w-[300px] mt-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-[100px]" />
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              {Array.from({ length: 5 }).map((_, j) => (
                <Skeleton key={j} className="h-5 w-[100px]" />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
} 