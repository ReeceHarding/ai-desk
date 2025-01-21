"use client"

import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, ChevronRight, Plus, Building, User, Globe, Phone, Hash, MessageSquare, Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"

export function DetailsPanel({ isOpen }: { isOpen: boolean }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 20 }}
          className="fixed inset-y-0 right-0 w-[400px] bg-slate-900 border-l border-slate-800 flex flex-col z-10 overflow-auto"
        >
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-lg font-semibold text-white">Details</h2>
          </div>

          <div className="flex-1 p-4 space-y-6">
            {/* Assignee Section */}
            <div>
              <h3 className="text-sm font-medium text-slate-400 mb-2">Assignee</h3>
              <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 transition-colors cursor-pointer">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="/placeholder.svg" />
                  <AvatarFallback>RH</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-200">Reece Harding</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </div>
            </div>

            {/* Team Section */}
            <div>
              <h3 className="text-sm font-medium text-slate-400 mb-2">Team Inbox</h3>
              <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 transition-colors cursor-pointer">
                <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center">
                  <MessageSquare className="h-4 w-4 text-slate-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-200">Unassigned</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </div>
            </div>

            {/* Links Section */}
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center justify-between w-full">
                <h3 className="text-sm font-medium text-slate-400">Links</h3>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-2">
                <Button variant="ghost" className="w-full justify-start text-slate-400 hover:text-white">
                  <Link2 className="h-4 w-4 mr-2" />
                  Tracker ticket
                </Button>
                <Button variant="ghost" className="w-full justify-start text-slate-400 hover:text-white">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Back-office tickets
                </Button>
                <Button variant="ghost" className="w-full justify-start text-slate-400 hover:text-white">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Side conversations
                </Button>
              </CollapsibleContent>
            </Collapsible>

            {/* Conversation Attributes */}
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center justify-between w-full">
                <h3 className="text-sm font-medium text-slate-400">Conversation Attributes</h3>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">ID</span>
                  <span className="text-sm text-slate-200">1</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Brand</span>
                  <span className="text-sm text-slate-200">Reece</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Subject</span>
                  <Button variant="ghost" size="sm" className="h-6">
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Language</span>
                  <span className="text-sm text-slate-200">English</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">External ID</span>
                  <Button variant="ghost" size="sm" className="h-6">
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* User Data */}
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center justify-between w-full">
                <h3 className="text-sm font-medium text-slate-400">User Data</h3>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-2">
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 transition-colors">
                  <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center">
                    <Phone className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-200">Phone & SMS</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 transition-colors">
                  <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center">
                    <Building className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-200">[Demo]</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 transition-colors">
                  <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center">
                    <User className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-200">User</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 transition-colors">
                  <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center">
                    <Globe className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-200">Owner</p>
                    <p className="text-xs text-slate-400">—</p>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

