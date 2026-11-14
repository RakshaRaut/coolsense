import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { cn } from '@/utils/format'
import { Card } from '@/components/common/Card'

export interface MetricCardProps {
  label: string
  value: string
  unit?: string
  icon: ReactNode
  trend?: number | null
  trendLabel?: string
  positiveIsGood?: boolean
  accent?: 'accent' | 'violet' | 'success' | 'warning' | 'danger'
  footer?: ReactNode
  className?: string
}

const ACCENTS = {
  accent: 'text-accent bg-accent-soft border-accent/20',
  violet: 'text-violet bg-violet-soft border-violet/20',
  success: 'text-success bg-success-soft border-success/20',
  warning: 'text-warning bg-warning-soft border-warning/20',
  danger: 'text-danger bg-danger-soft border-danger/20',
}

export function MetricCard({
  label,
  value,
  unit,
  icon,
  trend,
  trendLabel,
  positiveIsGood = true,
  accent = 'accent',
  footer,
  className,
}: MetricCardProps) {
  const hasTrend = trend != null && Number.isFinite(trend)
  const good = hasTrend ? (trend >= 0 ? positiveIsGood : !positiveIsGood) : true
  const TrendIcon = !hasTrend ? Minus : trend > 0.5 ? ArrowUpRight : trend < -0.5 ? ArrowDownRight : Minus

  return (
    <Card className={cn('group p-4 transition-colors hover:border-line-strong', className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase">{label}</p>
        <span
          className={cn(
            'grid size-7 shrink-0 place-items-center rounded-lg border transition-transform duration-200 group-hover:scale-105',
            ACCENTS[accent],
          )}
        >
          {icon}
        </span>
      </div>

      <div className="mt-2.5 flex items-baseline gap-1">
        <span className="tnum text-[24px] leading-none font-semibold tracking-[-0.02em] text-fg">
          {value}
        </span>
        {unit ? <span className="text-[11px] font-medium text-muted">{unit}</span> : null}
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        {hasTrend ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[10px] font-semibold',
              good ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger',
            )}
          >
            <TrendIcon className="size-2.5" />
            {Math.abs(trend).toFixed(1)}%
          </span>
        ) : null}
        <span className="truncate text-[10.5px] text-muted">{footer ?? trendLabel}</span>
      </div>
    </Card>
  )
}
