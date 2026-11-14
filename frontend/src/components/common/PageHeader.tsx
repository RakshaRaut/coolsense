import type { ReactNode } from 'react'
import { cn } from '@/utils/format'

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: ReactNode
  title: string
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-1.5 flex items-center gap-2 text-[10.5px] font-semibold tracking-[0.14em] text-accent uppercase">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.02em] text-fg sm:text-[26px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-[12.5px] leading-5 text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function Tooltip({
  label,
  children,
  side = 'top',
}: {
  label: string
  children: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
}) {
  const position =
    side === 'bottom'
      ? 'top-full mt-2 left-1/2 -translate-x-1/2'
      : side === 'left'
        ? 'right-full mr-2 top-1/2 -translate-y-1/2'
        : side === 'right'
          ? 'left-full ml-2 top-1/2 -translate-y-1/2'
          : 'bottom-full mb-2 left-1/2 -translate-x-1/2'

  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-40 w-max max-w-[220px] rounded-md border border-line bg-[var(--elevated)] px-2 py-1 text-[10.5px] leading-4 font-medium text-fg-soft opacity-0 shadow-pop transition-opacity duration-150 group-hover/tip:opacity-100',
          position,
        )}
      >
        {label}
      </span>
    </span>
  )
}

/** Small stat used inside cards: label above, value below. */
export function StatBlock({
  label,
  value,
  unit,
  tone = 'default',
  className,
}: {
  label: string
  value: string
  unit?: string
  tone?: 'default' | 'accent' | 'success' | 'warning' | 'danger'
  className?: string
}) {
  const tones = {
    default: 'text-fg',
    accent: 'text-accent',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
  }
  return (
    <div className={cn('min-w-0', className)}>
      <p className="truncate text-[10.5px] font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className={cn('tnum mt-1 text-[17px] leading-tight font-semibold', tones[tone])}>
        {value}
        {unit ? <span className="ml-1 text-[11px] font-medium text-muted">{unit}</span> : null}
      </p>
    </div>
  )
}
