import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/utils/format'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean
  interactive?: boolean
}

export function Card({ className, padded = false, interactive = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'surface relative overflow-hidden',
        padded && 'p-5',
        interactive &&
          'transition-all duration-200 hover:border-line-strong hover:shadow-[0_18px_44px_-30px_rgb(2_6_23/0.9)]',
        className,
      )}
      {...props}
    />
  )
}

interface CardHeaderProps {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  className?: string
  divider?: boolean
}

export function CardHeader({ title, description, icon, action, className, divider = true }: CardHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 px-5 pt-4.5 pb-3.5',
        divider && 'border-b border-line',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-card-2 text-accent">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h3 className="truncate text-[13.5px] font-semibold tracking-tight text-fg">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-[11.5px] leading-4 text-muted">{description}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-1.5">{action}</div> : null}
    </div>
  )
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center justify-between gap-3 border-t border-line px-5 py-3', className)}
      {...props}
    />
  )
}

/** Small section heading used above groups of cards. */
export function SectionHeading({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-3', className)}>
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight text-fg">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}
