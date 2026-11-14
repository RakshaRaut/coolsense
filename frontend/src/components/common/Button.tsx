import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/utils/format'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-white dark:text-[#04141f] font-semibold hover:brightness-110 active:brightness-95 shadow-[0_8px_24px_-12px_var(--accent)]',
  secondary:
    'bg-elevated text-fg border border-line hover:border-line-strong hover:bg-card-2 font-medium',
  outline:
    'border border-line-strong text-fg-soft hover:border-accent/60 hover:text-fg hover:bg-accent-soft font-medium',
  ghost: 'text-muted hover:text-fg hover:bg-card-2 font-medium',
  danger: 'bg-danger text-white font-semibold hover:brightness-110 shadow-[0_8px_24px_-14px_var(--danger)]',
  success: 'bg-success text-white font-semibold hover:brightness-110',
}

const SIZES: Record<ButtonSize, string> = {
  xs: 'h-7 px-2.5 text-[11px] gap-1.5 rounded-lg',
  sm: 'h-9 px-3 text-[12.5px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-[13px] gap-2 rounded-[10px]',
  lg: 'h-11 px-5 text-sm gap-2 rounded-xl',
  icon: 'size-9 rounded-lg justify-center',
}

export function buttonStyles(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md', className?: string) {
  return cn(
    'inline-flex items-center justify-center whitespace-nowrap transition-all duration-150 select-none',
    'disabled:pointer-events-none disabled:opacity-45',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
    VARIANTS[variant],
    SIZES[size],
    className,
  )
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
  iconRight?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading = false, icon, iconRight, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={props.type ?? 'button'}
      disabled={disabled || loading}
      className={buttonStyles(variant, size, className)}
      {...props}
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  )
})
