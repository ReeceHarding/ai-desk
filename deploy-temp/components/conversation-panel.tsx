import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Phone, MoreHorizontal, Star, Send, ImageIcon, Smile, Command, X, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"

export function ConversationPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [message, setMessage] = useState("")

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 20 }}
          className="fixed inset-y-0 right-0 w-[600px] bg-slate-900 border-l border-slate-800 flex flex-col z-20"
        >
          {/* Header */}
          <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                <Phone className="h-5 w-5 text-slate-300" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Phone & SMS</h2>
                <p className="text-sm text-slate-400">Last active 7m ago</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                      <Star className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Star conversation</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                      <MoreHorizontal className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>More options</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white" onClick={onClose}>
                      <X className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Close</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-auto p-4 space-y-4">
            <div className="flex justify-center">
              <Badge variant="secondary" className="bg-slate-800 text-slate-300">
                Today
              </Badge>
            </div>

            {/* System Message */}
            <div className="bg-slate-800/50 rounded-lg p-4 backdrop-blur-sm">
              <p className="text-slate-300">
                This is a demo message. It shows how a customer conversation from SMS will look in your inbox.
              </p>
              <p className="text-slate-300 mt-2">
                Once a channel is set up, all conversations come straight to your inbox, so you can route them to the
                right team.
              </p>
            </div>

            {/* Error Message */}
            <div className="flex items-start gap-3">
              <Avatar className="w-8 h-8 bg-red-900/20 text-red-500">
                <AvatarFallback>
                  <AlertCircle className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="bg-red-500/10 text-red-400 rounded-lg p-3 text-sm">
                  User does not have a valid phone number
                </div>
                <span className="text-xs text-slate-500 mt-1 block">37m ago</span>
              </div>
            </div>
          </div>

          {/* Composer */}
          <div className="p-4 border-t border-slate-800 bg-slate-900/50 backdrop-blur-sm">
            <div className="relative">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..."
                className="min-h-[100px] bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-400 resize-none pr-20"
              />
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                  <ImageIcon className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                  <Smile className="h-5 w-5" />
                </Button>
                <Button size="icon" className="bg-blue-600 hover:bg-blue-700">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
              <span>
                Use <kbd className="px-2 py-1 rounded bg-slate-800 text-slate-300">⌘K</kbd> for shortcuts
              </span>
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                <Command className="h-4 w-4 mr-1" />
                Commands
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

