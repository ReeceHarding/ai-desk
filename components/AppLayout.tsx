"use client"

import { Toaster } from '@/components/ui/toaster'
import { ToastProvider } from '@/components/ui/use-toast'
import { ReactNode } from 'react'

interface AppLayoutProps {
  children: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-gray-50">
        <main className="min-h-screen">{children}</main>
        <Toaster />
      </div>
    </ToastProvider>
  )
} 