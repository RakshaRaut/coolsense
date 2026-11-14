import type { FanSpeed } from '@/types'
import { FAN_META, FAN_LIST } from '@/utils/constants'
import { cn } from '@/utils/format'

interface ACFanControlProps {
  value: FanSpeed
  onChange: (speed: FanSpeed) => void
  disabled?: boolean
}

export function ACFanControl({ value, onChange, disabled }: ACFanControlProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-muted uppercase">Fan speed</p>
        <span className="text-[10px] text-muted">
          {value === 'auto' ? 'Managed by the unit' : `${FAN_META[value].powerW} W fan draw`}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {FAN_LIST.map((fan) => {
          const active = fan.value === value
          const bars = { auto: 3, low: 1, medium: 2, high: 3, turbo: 4 }[fan.value]
          return (
            <button
              key={fan.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(fan.value)}
              aria-pressed={active}
              className={cn(
                'flex h-10 flex-col items-center justify-center gap-1 rounded-lg border text-[10px] font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40',
                active
                  ? 'border-accent/40 bg-accent-soft text-accent'
                  : 'border-line bg-card-2 text-muted hover:border-line-strong hover:text-fg',
              )}
            >
              <span className="flex h-2.5 items-end gap-[2px]" aria-hidden>
                {Array.from({ length: 4 }).map((_, index) => (
                  <span
                    key={index}
                    className={cn(
                      'w-[2.5px] rounded-sm transition-all',
                      index < bars ? 'bg-current' : 'bg-current/25',
                    )}
                    style={{ height: `${5 + index * 2.5}px` }}
                  />
                ))}
              </span>
              {fan.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
