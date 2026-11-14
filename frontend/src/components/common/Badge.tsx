import type { ReactNode } from 'react'
import { cn } from '@/utils/format'

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'violet'

const TONES: Record<BadgeTone, string> = {
  neutral: 'border-line bg-card-2 text-muted',
  accent: 'border-accent/25 bg-accent-soft text-accent-ink',
  success: 'border-success/25 bg-success-soft text-success',
  warning: 'border-warning/25 bg-warning-soft text-warning',
  danger: 'border-danger/25 bg-danger-soft text-danger',
  violet: 'border-violet/25 bg-violet-soft text-violet',
}

export function Badge({
  children,
  tone = 'neutral',
  className,
  dot = false,
}: {
  children: ReactNode
  tone?: BadgeTone
  className?: string
  dot?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold tracking-wide whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  )
}

export function StatusDot({
  tone = 'success',
  pulse = false,
  className,
}: {
  tone?: 'success' | 'warning' | 'danger' | 'neutral' | 'accent'
  pulse?: boolean
  className?: string
}) {
  const color =
    tone === 'success'
      ? 'bg-success'
      : tone === 'warning'
        ? 'bg-warning'
        : tone === 'danger'
          ? 'bg-danger'
          : tone === 'accent'
            ? 'bg-accent'
            : 'bg-muted'

  return (
    <span className={cn('relative inline-flex size-2 shrink-0', className)} aria-hidden>
      {pulse ? (
        <span className={cn('absolute inset-0 animate-ping rounded-full opacity-60', color)} />
      ) : null}
      <span className={cn('relative size-2 rounded-full', color)} />
    </span>
  )
}
