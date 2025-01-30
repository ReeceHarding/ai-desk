import * as React from "react"

export interface ToastProps {
  variant?: "default" | "destructive"
  className?: string
  children?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export type ToastActionElement = React.ReactElement 