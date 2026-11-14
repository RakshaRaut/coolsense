import { forwardRef, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/utils/format'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
  options?: Array<{ value: string | number; label: string; disabled?: boolean }>
  sizeVariant?: 'sm' | 'md'
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, options, children, sizeVariant = 'md', ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'w-full cursor-pointer appearance-none rounded-[10px] border bg-card-2 pr-9 pl-3 text-[13px] text-fg transition-colors focus:bg-card focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60',
          sizeVariant === 'sm' ? 'h-8 text-[12px]' : 'h-10',
          invalid
            ? 'border-danger/60 focus:border-danger focus:ring-danger/10'
            : 'border-line hover:border-line-strong focus:border-accent/70 focus:ring-accent/10',
          className,
        )}
        aria-invalid={invalid || undefined}
        {...props}
      >
        {options
          ? options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))
          : children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-muted" />
    </div>
  )
})

interface SegmentedControlProps<T extends string | number> {
  value: T
  onChange: (value: T) => void
  options: Array<{ value: T; label: string; icon?: React.ReactNode }>
  size?: 'sm' | 'md'
  className?: string
  ariaLabel?: string
}

export function SegmentedControl<T extends string | number>({
  value,
  onChange,
  options,
  size = 'sm',
  className,
  ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('inline-flex items-center gap-0.5 rounded-[10px] border border-line bg-card-2 p-0.5', className)}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg font-medium transition-all duration-150',
              size === 'sm' ? 'h-7 px-2.5 text-[11.5px]' : 'h-8 px-3 text-xs',
              active
                ? 'bg-card text-fg shadow-[0_1px_2px_rgb(2_6_23/0.3)] ring-1 ring-line-strong'
                : 'text-muted hover:text-fg',
            )}
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
