import type { LucideIcon } from "lucide-react"

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode
}

interface NavItem {
  icon: LucideIcon
  label: string
  href: string
  badge?: number
}

interface Conversation {
  id: string
  user: {
    type: string
    icon: LucideIcon
  }
  company: string
  subject: string
  activity?: string
  description?: string
  priority: boolean
  waitingSince?: string
  lastUpdated: string
  sla?: string
  status: "open" | "closed" | "pending"
}

