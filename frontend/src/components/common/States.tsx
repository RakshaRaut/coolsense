import type { ReactNode } from 'react'
import { AlertTriangle, CloudOff, RefreshCw } from 'lucide-react'
import { cn } from '@/utils/format'
import { Badge } from './Badge'
import { Button } from './Button'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-shimmer rounded-md bg-[linear-gradient(90deg,var(--card-2)_25%,var(--elevated)_50%,var(--card-2)_75%)] bg-[length:200%_100%]',
        className,
      )}
    />
  )
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('surface space-y-4 p-5', className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="size-8 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-2.5 w-full" />
    </div>
  )
}

export function SkeletonChart({ height = 240 }: { height?: number }) {
  return (
    <div className="surface p-5" style={{ minHeight: height }}>
      <Skeleton className="h-3 w-40" />
      <div className="mt-6 flex h-[calc(100%-2rem)] items-end gap-2">
        {[62, 78, 44, 90, 58, 72, 36, 84, 50, 68, 40, 76].map((h, i) => (
          <div key={i} className="flex-1" style={{ height: `${h}%` }}>
            <Skeleton className="size-full rounded-sm" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-card-2/40 px-6 py-14 text-center',
        className,
      )}
    >
      <span className="mb-4 grid size-14 place-items-center rounded-2xl border border-line bg-card text-accent shadow-[0_0_40px_-12px_var(--accent)]">
        {icon}
      </span>
      <h3 className="text-[15px] font-semibold text-fg">{title}</h3>
      <p className="mt-1.5 max-w-sm text-[12.5px] leading-6 text-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function ErrorState({
  message,
  onRetry,
  compact = false,
}: {
  message: string
  onRetry?: () => void
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 rounded-xl border border-danger/25 bg-danger-soft',
        compact ? 'px-3.5 py-3' : 'px-5 py-4',
      )}
    >
      <div className="flex items-start gap-3">
        <CloudOff className="mt-0.5 size-4 shrink-0 text-danger" />
        <div>
          <p className="text-[12.5px] font-semibold text-fg">Unable to load data</p>
          <p className="mt-0.5 text-[11.5px] leading-5 text-muted">{message}</p>
        </div>
      </div>
      {onRetry ? (
        <Button size="sm" variant="outline" icon={<RefreshCw className="size-3.5" />} onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  )
}

export function DataSourceBadge({ source }: { source: 'backend' | 'mock' }) {
  return source === 'mock' ? (
    <Badge tone="warning" dot>
      MOCK DATA
    </Badge>
  ) : (
    <Badge tone="success" dot>
      LIVE
    </Badge>
  )
}

export function OfflineNotice({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3">
      <AlertTriangle className="size-4 shrink-0 text-warning" />
      <p className="text-[12px] leading-5 text-fg-soft">{message}</p>
    </div>
  )
}
