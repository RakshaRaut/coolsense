import { cn } from '@/utils/format'

interface SliderProps {
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  onCommit?: (value: number) => void
  label?: string
  unit?: string
  hint?: string
  accentClass?: string
  disabled?: boolean
  className?: string
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  onCommit,
  label,
  unit,
  hint,
  disabled,
  className,
}: SliderProps) {
  const progress = ((value - min) / (max - min)) * 100
  return (
    <div className={cn('space-y-2', className)}>
      {label || unit ? (
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[11.5px] font-medium text-fg-soft">{label}</span>
          <span className="tnum rounded-md border border-line bg-card-2 px-1.5 py-0.5 text-[11px] font-semibold text-fg">
            {value.toFixed(step < 1 ? 1 : 0)}
            {unit ? <span className="ml-0.5 text-[10px] font-medium text-muted">{unit}</span> : null}
          </span>
        </div>
      ) : null}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerUp={(event) => onCommit?.(Number((event.target as HTMLInputElement).value))}
        onKeyUp={(event) => onCommit?.(Number((event.target as HTMLInputElement).value))}
        style={{ ['--range-progress' as string]: `${progress}%` }}
        className={cn('disabled:cursor-not-allowed disabled:opacity-50')}
      />
      {hint ? <p className="text-[10.5px] text-muted">{hint}</p> : null}
    </div>
  )
}

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function Switch({ checked, onChange, label, description, disabled, size = 'md', className }: SwitchProps) {
  const track = size === 'sm' ? 'h-5 w-9' : 'h-6 w-11'
  const knob = size === 'sm' ? 'size-3.5' : 'size-4.5'
  const translate = size === 'sm' ? 'translate-x-4' : 'translate-x-5'

  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-3',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex shrink-0 items-center rounded-full border transition-colors duration-200',
          track,
          checked
            ? 'border-accent/50 bg-accent shadow-[0_0_16px_-4px_var(--accent)]'
            : 'border-line-strong bg-card-2',
        )}
      >
        <span
          className={cn(
            'absolute left-0.5 rounded-full bg-white shadow-sm transition-transform duration-200',
            knob,
            checked ? translate : 'translate-x-0',
          )}
        />
      </button>
      {label || description ? (
        <span className="min-w-0">
          {label ? <span className="block text-[12.5px] font-medium text-fg">{label}</span> : null}
          {description ? <span className="block text-[11px] text-muted">{description}</span> : null}
        </span>
      ) : null}
    </label>
  )
}
