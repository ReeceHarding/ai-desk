import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { motion } from "framer-motion"
import {
    BarChart,
    Bell,
    ChevronDown,
    Clock,
    Filter,
    Home,
    MessageSquare,
    MoreHorizontal,
    Phone,
    Search,
    Star,
    Users,
} from "lucide-react"
import { useState } from "react"
import { ConversationPanel } from "./conversation-panel"
import { DetailsPanel } from "./details-panel"
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { ScrollArea } from "@/components/ui/scroll-area";

export default function InboxInterface() {
  const [isLoading] = useState(false)
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)

  const handleRowClick = (id: string) => {
    setSelectedConversation(id)
  }

  const handleClose = () => {
    setSelectedConversation(null)
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-slate-900 to-slate-950">
      <div className="flex flex-1 relative overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-16 bg-slate-950/50 backdrop-blur-sm flex flex-col items-center py-4 border-r border-slate-800 z-10">
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

        {/* Main Content - Wrapped in motion.div */}
        <motion.div 
          className="flex-1"
          animate={{
            x: selectedConversation ? "-300px" : "0px",
            width: selectedConversation ? "calc(100% + 300px)" : "100%"
          }}
          transition={{ type: "spring", bounce: 0, duration: 0.4 }}
        >
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
        </motion.div>

        {/* Conversation Panel */}
        <ConversationPanel 
          isOpen={selectedConversation !== null} 
          onClose={handleClose}
        />
      </div>
      <DetailsPanel isOpen={!!selectedConversation} />
    </div>
  )
}

