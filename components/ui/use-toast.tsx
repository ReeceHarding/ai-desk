"use client"

import * as React from "react"
import type { ToastActionElement, ToastProps } from "./toast"

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 1000000

export type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

export type Toast = Omit<ToasterToast, "id">

const ToastContext = React.createContext<{
  toasts: ToasterToast[]
  addToast: (toast: Toast) => void
  removeToast: (id: string) => void
  updateToast: (id: string, toast: Partial<ToasterToast>) => void
}>({
  toasts: [],
  addToast: () => {},
  removeToast: () => {},
  updateToast: () => {},
})

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToasterToast[]>([])

  const addToast = React.useCallback((toast: Toast) => {
    const id = Math.random().toString(36).substr(2, 9)
    setToasts((prev) => [...prev, { ...toast, id }])
  }, [])

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const updateToast = React.useCallback((id: string, toast: Partial<ToasterToast>) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...toast } : t))
    )
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, updateToast }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }

  return React.useMemo(
    () => ({
      toast: (props: Toast) => {
        context.addToast(props)
      },
      dismiss: (toastId?: string) => {
        if (toastId) {
          context.removeToast(toastId)
        }
      },
      toasts: context.toasts,
    }),
    [context]
  )
} 
