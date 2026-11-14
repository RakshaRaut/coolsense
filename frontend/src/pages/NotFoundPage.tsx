import { Link } from 'react-router-dom'
import { ArrowLeft, Snowflake } from 'lucide-react'
import { buttonStyles } from '@/components/common/Button'

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-[linear-gradient(145deg,#38BDF8,#6366F1)] text-white shadow-[0_12px_40px_-12px_rgb(56_189_248/0.8)]">
        <Snowflake className="size-6" />
      </span>
      <p className="mt-6 text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">Error 404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-fg">This room doesn&apos;t exist</h1>
      <p className="mt-2 max-w-sm text-[12.5px] leading-6 text-muted">
        The page you are looking for was moved, renamed or never wired into the simulation.
      </p>
      <Link to="/dashboard" className={buttonStyles('primary', 'md', 'mt-6')}>
        <ArrowLeft className="size-4" /> Back to overview
      </Link>
    </div>
  )
}
