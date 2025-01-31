import { AgentPerformanceTable } from "@/components/admin/agent-performance-table"
import { OrgOverview } from "@/components/admin/org-overview"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fetchAdminDashboardStats, type AdminDashboardStats } from "@/utils/adminDashboard"
import { useSupabaseClient } from "@supabase/auth-helpers-react"
import { RefreshCw, Settings, Ticket, Users } from "lucide-react"
import Head from "next/head"
import { useRouter } from "next/router"
import { useEffect, useState } from "react"

interface Profile {
  id: string
  display_name: string
  role: string
  org_id: string
}

export default function AdminDashboard() {
  const supabase = useSupabaseClient()
  const router = useRouter()
  const [stats, setStats] = useState<AdminDashboardStats | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("overview")

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("No user found")

        // Get admin's profile
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single()

        if (profileError) throw profileError
        setProfile(profileData)

        // Fetch all dashboard stats
        const dashboardStats = await fetchAdminDashboardStats(profileData.org_id)
        setStats(dashboardStats)
      } catch (err: any) {
        console.error("Error fetching admin data:", err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [supabase])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Head>
        <title>Admin Dashboard - Zendesk</title>
      </Head>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Welcome back, {profile?.display_name}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Here's an overview of your system
            </p>
          </div>

          {stats && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="bg-white dark:bg-slate-800 overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Users className="h-6 w-6 text-blue-500" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">
                          Total Users
                        </dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                            {stats.totalUsers}
                          </div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 px-5 py-3">
                  <div className="text-sm">
                    <button
                      onClick={() => router.push("/admin/users")}
                      className="font-medium text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                    >
                      View all users
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Ticket className="h-6 w-6 text-green-500" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">
                          Total Tickets
                        </dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                            {stats.totalTickets}
                          </div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 px-5 py-3">
                  <div className="text-sm">
                    <button
                      onClick={() => router.push("/admin/tickets")}
                      className="font-medium text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                    >
                      View all tickets
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Settings className="h-6 w-6 text-indigo-500" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">
                          Organizations
                        </dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-slate-900 dark:text-white">
                            {stats.totalOrganizations}
                          </div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 px-5 py-3">
                  <div className="text-sm">
                    <button
                      onClick={() => router.push("/admin/organizations")}
                      className="font-medium text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                    >
                      Manage organizations
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="overview">Organization Overview</TabsTrigger>
                <TabsTrigger value="agents">Agent Performance</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-6">
                <OrgOverview data={stats?.orgPerformance} loading={loading} />
              </TabsContent>

              <TabsContent value="agents" className="mt-6">
                <AgentPerformanceTable data={stats?.agentPerformance} loading={loading} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  )
} 