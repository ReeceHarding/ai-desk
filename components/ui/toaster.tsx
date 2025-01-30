"use client"

import * as React from "react"
import { ToastProps } from "./toast"
import { useToast } from "./use-toast"

const Toast: React.FC<ToastProps> = React.forwardRef<
  HTMLDivElement,
  ToastProps
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={className}
    {...props}
  >
    {children}
  </div>
))
Toast.displayName = "Toast"

const ToastTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-sm font-semibold">{children}</div>
)

const ToastDescription: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-sm opacity-90">{children}</div>
)

const ToastClose: React.FC = () => (
  <button className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
    ×
  </button>
)

const ToastViewport: React.FC = () => (
  <div className="fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]" />
)

export function Toaster() {
  const { toasts } = useToast()

  return (
    <div>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </div>
  )
} 