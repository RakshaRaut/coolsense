import type { AcMode } from '@/types'
import { MODE_META_LIST } from '@/utils/constants'
import { cn } from '@/utils/format'
import { Tooltip } from '@/components/common/PageHeader'

interface ACModeSelectorProps {
  value: AcMode
  supportsHeating: boolean
  onChange: (mode: AcMode) => void
  disabled?: boolean
}

export function ACModeSelector({ value, supportsHeating, onChange, disabled }: ACModeSelectorProps) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold tracking-[0.14em] text-muted uppercase">Operating mode</p>
      <div className="grid grid-cols-5 gap-1.5">
        {MODE_META_LIST.map((mode) => {
          const Icon = mode.icon
          const isDisabled = disabled || (mode.value === 'heat' && !supportsHeating)
          const active = mode.value === value
          const button = (
            <button
              type="button"
              key={mode.value}
              disabled={isDisabled}
              onClick={() => onChange(mode.value)}
              aria-pressed={active}
              className={cn(
                'group relative flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2.5 transition-all duration-150',
                active
                  ? 'border-accent/40 bg-accent-soft text-accent shadow-[0_0_0_1px_var(--accent-soft)]'
                  : 'border-line bg-card-2 text-muted hover:border-line-strong hover:text-fg',
                isDisabled && 'cursor-not-allowed opacity-35 hover:border-line hover:text-muted',
              )}
            >
              <Icon className={cn('size-[17px] transition-transform duration-200', active && 'scale-110')} />
              <span className="text-[10px] font-semibold tracking-wide">{mode.label}</span>
              {active ? (
                <span className="absolute -top-px left-1/2 h-[2px] w-5 -translate-x-1/2 rounded-full bg-accent" />
              ) : null}
            </button>
          )
          return isDisabled && mode.value === 'heat' ? (
            <Tooltip key={mode.value} label="This model does not support heating">
              {button}
            </Tooltip>
          ) : (
            button
          )
        })}
      </div>
      <p className="mt-2 text-[10.5px] text-muted">{MODE_META_LIST.find((m) => m.value === value)?.hint}</p>
    </div>
  )
}
