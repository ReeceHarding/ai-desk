import type { Database } from '@/types/supabase'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export interface DashboardStats {
  ticketStats: {
    open: number
    solved: number
    highPriority: number
    avgResponseHours: number
    byStatus: Record<string, number>
    byPriority: Record<string, number>
    responseTimeHistory: Array<{date: string, hours: number}>
  }
  userStats: {
    totalAgents: number
    totalCustomers: number
    activeAgents: Array<{id: string, name: string, openTickets: number}>
  }
  orgStats: {
    totalOrgs: number
    activeOrgs: number
    storageUsage: number
  }
  emailStats: {
    totalEmails: number
    inboundCount: number
    outboundCount: number
    averageResponseTime: number
    emailsOverTime: Array<{date: string, count: number}>
  }
}

export async function fetchDashboardStats(orgId: string): Promise<DashboardStats> {
  const supabase = createClientComponentClient<Database>()
  
  // Parallel queries for better performance
  const [
    ticketsResponse,
    usersResponse,
    emailLogsResponse,
    ticketEmailChatsResponse
  ] = await Promise.all([
    // Ticket stats
    supabase
      .from('tickets')
      .select('id, status, priority, created_at, updated_at, assigned_agent_id')
      .eq('org_id', orgId),
    
    // User stats
    supabase
      .from('profiles')
      .select('id, role, display_name')
      .eq('org_id', orgId),
    
    // Email logs
    supabase
      .from('email_logs')
      .select('*')
      .eq('org_id', orgId),

    // Ticket email chats for response time
    supabase
      .from('ticket_email_chats')
      .select('*')
      .eq('org_id', orgId)
  ])

  const tickets = ticketsResponse.data || []
  const users = usersResponse.data || []
  const emailLogs = emailLogsResponse.data || []
  const emailChats = ticketEmailChatsResponse.data || []

  // Process ticket statistics
  const ticketStats = {
    open: tickets.filter(t => t.status === 'open').length,
    solved: tickets.filter(t => t.status === 'solved').length,
    highPriority: tickets.filter(t => t.priority === 'high' || t.priority === 'urgent').length,
    avgResponseHours: calculateAverageResponseTime(tickets),
    byStatus: calculateTicketsByStatus(tickets),
    byPriority: calculateTicketsByPriority(tickets),
    responseTimeHistory: calculateResponseTimeHistory(tickets)
  }

  // Process user statistics
  const agents = users.filter(u => u.role === 'agent')
  const userStats = {
    totalAgents: agents.length,
    totalCustomers: users.filter(u => u.role === 'customer').length,
    activeAgents: agents.map(agent => ({
      id: agent.id,
      name: agent.display_name || 'Unknown',
      openTickets: tickets.filter(t => t.assigned_agent_id === agent.id && t.status === 'open').length
    }))
  }

  // Process email statistics
  const emailStats = {
    totalEmails: emailLogs.length,
    inboundCount: emailLogs.filter(e => e.direction === 'inbound').length,
    outboundCount: emailLogs.filter(e => e.direction === 'outbound').length,
    averageResponseTime: calculateEmailResponseTime(emailChats),
    emailsOverTime: calculateEmailsOverTime(emailLogs)
  }

  // Organization stats (simplified for now)
  const orgStats = {
    totalOrgs: 1, // Since we're already filtering by orgId
    activeOrgs: 1,
    storageUsage: calculateStorageUsage(emailLogs)
  }

  return {
    ticketStats,
    userStats,
    orgStats,
    emailStats
  }
}

function calculateTicketsByStatus(tickets: any[]): Record<string, number> {
  return tickets.reduce((acc, ticket) => {
    acc[ticket.status] = (acc[ticket.status] || 0) + 1
    return acc
  }, {})
}

function calculateTicketsByPriority(tickets: any[]): Record<string, number> {
  return tickets.reduce((acc, ticket) => {
    acc[ticket.priority] = (acc[ticket.priority] || 0) + 1
    return acc
  }, {})
}

function calculateAverageResponseTime(tickets: any[]): number {
  const ticketsWithResponse = tickets.filter(t => t.updated_at && t.created_at)
  if (!ticketsWithResponse.length) return 0
  
  const totalHours = ticketsWithResponse.reduce((acc, t) => {
    const created = new Date(t.created_at).getTime()
    const updated = new Date(t.updated_at).getTime()
    return acc + ((updated - created) / (1000 * 60 * 60))
  }, 0)
  
  return Math.round(totalHours / ticketsWithResponse.length)
}

function calculateResponseTimeHistory(tickets: any[]): Array<{date: string, hours: number}> {
  const last30Days = Array.from({length: 30}, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - i)
    return date.toISOString().split('T')[0]
  }).reverse()

  return last30Days.map(date => {
    const dayTickets = tickets.filter(t => 
      t.created_at.startsWith(date) && t.updated_at
    )
    const avgHours = dayTickets.length ? 
      calculateAverageResponseTime(dayTickets) : 0

    return { date, hours: avgHours }
  })
}

function calculateEmailsOverTime(emails: any[]): Array<{date: string, count: number}> {
  const last30Days = Array.from({length: 30}, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - i)
    return date.toISOString().split('T')[0]
  }).reverse()

  return last30Days.map(date => ({
    date,
    count: emails.filter(e => e.created_at.startsWith(date)).length
  }))
}

function calculateEmailResponseTime(emailChats: any[]): number {
  interface EmailChat {
    thread_id: string
    created_at: string
  }

  const threadsWithResponses = emailChats.reduce<Record<string, EmailChat[]>>((acc, chat) => {
    if (!acc[chat.thread_id]) {
      acc[chat.thread_id] = []
    }
    acc[chat.thread_id].push(chat)
    return acc
  }, {})

  let totalResponseTime = 0
  let responseCount = 0

  Object.values(threadsWithResponses).forEach((thread: EmailChat[]) => {
    if (thread.length < 2) return

    const sortedThread = [...thread].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    for (let i = 1; i < sortedThread.length; i++) {
      const timeDiff = new Date(sortedThread[i].created_at).getTime() - 
                      new Date(sortedThread[i-1].created_at).getTime()
      totalResponseTime += timeDiff
      responseCount++
    }
  })

  return responseCount ? Math.round(totalResponseTime / responseCount / (1000 * 60 * 60)) : 0
}

function calculateStorageUsage(emailLogs: any[]): number {
  // Simplified calculation - assuming each email takes up roughly 100KB
  return Math.round(emailLogs.length * 100 / 1024) // Convert to MB
} 