import type { Database } from "@/types/supabase"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"

export interface AdminDashboardStats {
  totalUsers: number
  totalTickets: number
  totalOrganizations: number
  agentPerformance: Array<{
    agent_id: string
    agent_name: string
    tickets_assigned: number
    tickets_resolved: number
    avg_response_time: string
    avg_resolution_time: string
  }>
  orgPerformance: {
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
}

export async function fetchAdminDashboardStats(orgId: string): Promise<AdminDashboardStats> {
  const supabase = createClientComponentClient<Database>()

  const [
    usersResponse,
    ticketsResponse,
    orgsResponse,
    agentPerformanceResponse,
    orgPerformanceResponse
  ] = await Promise.all([
    // Get total users count
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true }),

    // Get total tickets count
    supabase
      .from("tickets")
      .select("*", { count: "exact", head: true }),

    // Get total organizations count
    supabase
      .from("organizations")
      .select("*", { count: "exact", head: true }),

    // Get agent performance data
    supabase
      .rpc("fn_get_agent_performance", {
        p_org_id: orgId
      }),

    // Get organization performance data
    supabase
      .rpc("fn_get_org_performance", {
        p_org_id: orgId
      })
  ])

  // Handle any errors
  if (usersResponse.error) throw usersResponse.error
  if (ticketsResponse.error) throw ticketsResponse.error
  if (orgsResponse.error) throw orgsResponse.error
  if (agentPerformanceResponse.error) throw agentPerformanceResponse.error
  if (orgPerformanceResponse.error) throw orgPerformanceResponse.error

  return {
    totalUsers: usersResponse.count || 0,
    totalTickets: ticketsResponse.count || 0,
    totalOrganizations: orgsResponse.count || 0,
    agentPerformance: agentPerformanceResponse.data || [],
    orgPerformance: orgPerformanceResponse.data || {
      total_tickets: 0,
      open_tickets: 0,
      solved_tickets: 0,
      avg_response_time: "0h",
      avg_resolution_time: "0h",
      sla_compliance_rate: 0,
      customer_satisfaction_rate: 0,
      tickets_by_priority: {},
      tickets_by_status: {},
      daily_ticket_stats: []
    }
  }
} 