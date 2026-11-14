import { NavLink } from 'react-router-dom'
import { LayoutDashboard, AirVent, SlidersHorizontal, FlaskConical, MoreHorizontal } from 'lucide-react'
import { cn } from '@/utils/format'

const ITEMS = [
  { label: 'Overview', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Devices', path: '/devices', icon: AirVent },
  { label: 'Control', path: '/control', icon: SlidersHorizontal },
  { label: 'Simulate', path: '/simulation', icon: FlaskConical },
]

export function MobileNavigation({ onOpenMore }: { onOpenMore: () => void }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      aria-label="Primary"
    >
      <div className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex h-15 flex-col items-center justify-center gap-1 text-[9.5px] font-medium transition-colors',
                  isActive ? 'text-accent' : 'text-muted',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'grid size-8 place-items-center rounded-lg transition-colors',
                      isActive && 'bg-accent-soft',
                    )}
                  >
                    <Icon className="size-4.5" strokeWidth={isActive ? 2.2 : 1.9} />
                  </span>
                  {item.label}
                </>
              )}
            </NavLink>
          )
        })}
        <button
          type="button"
          onClick={onOpenMore}
          className="flex h-15 flex-col items-center justify-center gap-1 text-[9.5px] font-medium text-muted transition-colors hover:text-fg"
        >
          <span className="grid size-8 place-items-center rounded-lg">
            <MoreHorizontal className="size-4.5" />
          </span>
          More
        </button>
      </div>
    </nav>
  )
}
