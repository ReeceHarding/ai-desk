import { LucideIcon } from 'lucide-react'
import { Skeleton } from './skeleton'

interface StatCardProps {
  title: string
  value?: number | string
  icon: LucideIcon
  loading?: boolean
  description?: string
  trend?: {
    value: number
    label: string
  }
}

export function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  loading = false,
  description,
  trend 
}: StatCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl bg-gradient-to-b from-white to-slate-50 border border-slate-200/50 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-blue-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"/>
      <div className="relative p-6">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
            <Icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {title}
            </dt>
            <dd className="mt-1 text-3xl font-semibold text-slate-900 dark:text-white">
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                typeof value === 'number' ? value.toLocaleString() : value ?? 0
              )}
            </dd>
            {description && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {description}
              </p>
            )}
            {trend && (
              <p className={`mt-2 text-sm ${
                trend.value > 0 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {trend.value > 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 