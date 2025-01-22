import { useState } from "react"
import { motion } from "framer-motion"
import {
  Search,
  Star,
  Filter,
  MoreHorizontal,
  Phone,
  MessageSquare,
  Bell,
  Home,
  Users,
  BarChart,
  ChevronDown,
  Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { ConversationPanel } from "./conversation-panel"
import { DetailsPanel } from "./details-panel"

export default function InboxInterface() {
  const [isLoading, setIsLoading] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState("all")
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)

  const handleRowClick = (id: string) => {
    setSelectedConversation(id)
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-slate-900 to-slate-950">
      {/* Trial Banner */}
      <div className="bg-gradient-to-r from-indigo-500/90 via-purple-500/90 to-pink-500/90 backdrop-blur-sm text-white p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-white/20 bg-white/10">
            Trial
          </Badge>
          <span className="text-sm font-medium">
            You have <strong>13 days</strong> left in your Advanced trial
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" className="bg-white text-black hover:bg-white/90 transition-colors">
            Buy Intercom
          </Button>
          <Button variant="ghost" size="sm" className="text-white hover:text-white hover:bg-white/10 transition-colors">
            Apply for an Early Stage 90% discount
          </Button>
        </div>
      </div>

      <div className="flex flex-1">
        {/* Left Sidebar */}
        <div className="w-16 bg-slate-950/50 backdrop-blur-sm flex flex-col items-center py-4 border-r border-slate-800">
          <TooltipProvider>
            <div className="space-y-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-800">
                    <Home className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Home</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-white bg-slate-700/50 hover:bg-slate-700">
                    <MessageSquare className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Messages</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-slate-400 hover:text-white hover:bg-slate-800 relative"
                  >
                    <Bell className="h-5 w-5" />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Notifications</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-800">
                    <Users className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Team</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-800">
                    <BarChart className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Analytics</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Toolbar */}
          <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <h1 className="text-xl font-semibold text-white">Inbox</h1>
                <Badge variant="secondary" className="bg-slate-700 text-slate-200">
                  1 Open
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search conversations..."
                    className="w-64 bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-400 pl-10"
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="border-slate-700 bg-slate-800/50 text-slate-200 hover:bg-slate-700 hover:text-white hover:border-slate-600">
                      <Filter className="h-4 w-4 mr-2" />
                      Filters
                      <ChevronDown className="h-4 w-4 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-slate-800 border-slate-700">
                    <DropdownMenuItem className="text-slate-200 hover:bg-slate-700/50 focus:bg-slate-700/50">
                      Unassigned
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-slate-200 hover:bg-slate-700/50 focus:bg-slate-700/50">
                      Priority
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-slate-200 hover:bg-slate-700/50 focus:bg-slate-700/50">
                      Recent
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm text-slate-300">
              <thead className="bg-slate-900/50 backdrop-blur-sm sticky top-0">
                <tr className="border-b border-slate-800">
                  <th className="text-left py-3 px-4 font-medium text-slate-300 hover:text-slate-200 transition-colors">User</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-300 hover:text-slate-200 transition-colors">Company</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-300 hover:text-slate-200 transition-colors">Subject / Title</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-300 hover:text-slate-200 transition-colors">Activity</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-300 hover:text-slate-200 transition-colors">Description</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-300 hover:text-slate-200 transition-colors">Priority</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-300 hover:text-slate-200 transition-colors">Waiting since</th>
                  <th className="text-left py-3 px-4 font-medium text-amber-500 hover:text-amber-400 transition-colors cursor-pointer group">
                    Last updated
                    <ChevronDown className="inline h-4 w-4 ml-1 group-hover:text-amber-400" />
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-slate-300 hover:text-slate-200 transition-colors">SLA</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-300 hover:text-slate-200 transition-colors">Status</th>
                </tr>
              </thead>
              <tbody>
                <motion.tr
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border-b border-slate-800 hover:bg-slate-800/50 transition-all duration-200 group cursor-pointer"
                  onClick={() => handleRowClick("1")}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-700/50 flex items-center justify-center text-slate-300 group-hover:bg-slate-700 transition-colors">
                        <Phone className="h-4 w-4" />
                      </div>
                      <span className="group-hover:text-white transition-colors">Phone & SMS</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="outline" className="border-slate-700 text-slate-300 group-hover:border-slate-600 group-hover:text-white transition-colors">
                      [Demo]
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-slate-200 group-hover:text-white transition-colors">how's it going?</span>
                  </td>
                  <td className="py-3 px-4 text-slate-500 group-hover:text-slate-400 transition-colors">—</td>
                  <td className="py-3 px-4 text-slate-500 group-hover:text-slate-400 transition-colors">—</td>
                  <td className="py-3 px-4">
                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-amber-400 transition-colors">
                      <Star className="h-4 w-4" />
                    </Button>
                  </td>
                  <td className="py-3 px-4 text-slate-500 group-hover:text-slate-400 transition-colors">—</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 text-slate-400 group-hover:text-slate-300 transition-colors">
                      <Clock className="h-4 w-4" />
                      <span>7m</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-500 group-hover:text-slate-400 transition-colors">—</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Button size="sm" className="bg-slate-700/50 text-white hover:bg-slate-600 transition-all duration-200">
                        Open
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-slate-400 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-all duration-200"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </motion.tr>
                {isLoading && (
                  <tr className="border-b border-slate-800">
                    <td colSpan={10} className="py-3 px-4">
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <Skeleton className="h-4 w-48" />
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <ConversationPanel isOpen={!!selectedConversation} onClose={() => setSelectedConversation(null)} />
      <DetailsPanel isOpen={!!selectedConversation} />
    </div>
  )
}

