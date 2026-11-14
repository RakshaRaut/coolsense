import type { ReactNode } from 'react'
import { BarChart3 } from 'lucide-react'
import { cn } from '@/utils/format'

export interface TooltipRow {
  dataKey?: string | number
  name?: string | number
  value?: number | string
  color?: string
  units?: string
}

interface ChartTooltipProps {
  active?: boolean
  payload?: TooltipRow[]
  label?: string | number
  titleFormatter?: (label: string | number) => string
  valueFormatter?: (value: number, dataKey: string) => string
  unitMap?: Record<string, string>
  nameMap?: Record<string, string>
}

export function ChartTooltip({
  active,
  payload,
  label,
  titleFormatter,
  valueFormatter,
  unitMap = {},
  nameMap = {},
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="rounded-xl border border-line bg-[var(--elevated)] px-3 py-2.5 shadow-pop">
      {label != null ? (
        <p className="mb-1.5 text-[10px] font-semibold tracking-[0.08em] text-muted uppercase">
          {titleFormatter ? titleFormatter(label) : String(label)}
        </p>
      ) : null}
      <div className="space-y-1">
        {payload.map((row) => {
          const key = String(row.dataKey ?? row.name ?? '')
          const numeric = typeof row.value === 'number' ? row.value : Number(row.value ?? 0)
          return (
            <div key={key} className="flex items-center justify-between gap-5">
              <span className="flex items-center gap-1.5 text-[11px] text-muted">
                <span
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: row.color ?? 'var(--accent)' }}
                />
                {nameMap[key] ?? String(row.name ?? key)}
              </span>
              <span className="tnum text-[11.5px] font-semibold text-fg">
                {valueFormatter
                  ? valueFormatter(numeric, key)
                  : `${Number.isInteger(numeric) ? numeric : numeric.toFixed(1)}`}
                <span className="ml-1 text-[10px] font-medium text-muted">{unitMap[key] ?? ''}</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ChartEmpty({ message, height = 240 }: { message: string; height?: number }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line"
      style={{ height }}
    >
      <BarChart3 className="size-5 text-muted/60" />
      <p className="text-[11.5px] text-muted">{message}</p>
    </div>
  )
}

export function ChartLegend({
  items,
  className,
}: {
  items: Array<{ label: string; color: string; dashed?: boolean }>
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5', className)}>
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-[10.5px] font-medium text-muted">
          <span
            className="h-0.5 w-3.5 rounded-full"
            style={{
              backgroundColor: item.dashed ? 'transparent' : item.color,
              borderTop: item.dashed ? `2px dashed ${item.color}` : undefined,
            }}
          />
          {item.label}
        </span>
      ))}
    </div>
  )
}

export function ChartFrame({
  children,
  height = 240,
  className,
}: {
  children: ReactNode
  height?: number
  className?: string
}) {
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      {children}
    </div>
  )
}
