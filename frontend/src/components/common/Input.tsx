import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/utils/format'

const baseField =
  'w-full rounded-[10px] border bg-card-2 text-[13px] text-fg placeholder:text-muted/70 transition-colors duration-150 focus:bg-card focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          baseField,
          'h-10 px-3',
          invalid
            ? 'border-danger/60 focus:border-danger focus:ring-danger/10'
            : 'border-line focus:border-accent/70 focus:ring-accent/10 hover:border-line-strong',
          className,
        )}
        aria-invalid={invalid || undefined}
        {...props}
      />
    )
  },
)

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        baseField,
        'min-h-24 resize-y px-3 py-2.5',
        invalid
          ? 'border-danger/60 focus:border-danger focus:ring-danger/10'
          : 'border-line focus:border-accent/70 focus:ring-accent/10 hover:border-line-strong',
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )
})

interface FieldProps {
  label?: ReactNode
  hint?: ReactNode
  error?: string
  required?: boolean
  className?: string
  children: ReactNode
  htmlFor?: string
}

export function Field({ label, hint, error, required, className, children, htmlFor }: FieldProps) {
  const autoId = useId()
  const id = htmlFor ?? autoId
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor={id} className="text-[11.5px] font-medium tracking-wide text-fg-soft">
            {label}
            {required ? <span className="ml-0.5 text-danger">*</span> : null}
          </label>
          {hint ? <span className="text-[10.5px] text-muted">{hint}</span> : null}
        </div>
      ) : null}
      {children}
      {error ? (
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-danger">
          <AlertCircle className="size-3 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function InputGroup({
  icon,
  suffix,
  children,
  className,
}: {
  icon?: ReactNode
  suffix?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('relative', className)}>
      {icon ? (
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">{icon}</span>
      ) : null}
      {children}
      {suffix ? (
        <span className="absolute top-1/2 right-3 -translate-y-1/2 text-[11px] font-medium text-muted">
          {suffix}
        </span>
      ) : null}
    </div>
  )
}
