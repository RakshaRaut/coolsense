import { NavLink } from 'react-router-dom'
import { ChevronLeft, Snowflake, X } from 'lucide-react'
import { cn } from '@/utils/format'
import { NAV_ITEMS } from '@/utils/navigation'
import { Badge } from '@/components/common/Badge'
import { Tooltip } from '@/components/common/PageHeader'
import { useSettings } from '@/contexts/SettingsProvider'

interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

export function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: SidebarProps) {
  const { settings } = useSettings()

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-[var(--overlay)] backdrop-blur-[2px] transition-opacity duration-300 lg:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onCloseMobile}
        aria-hidden
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-line bg-sidebar',
          'transition-[width,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
          collapsed ? 'lg:w-[84px]' : 'lg:w-[264px]',
          'w-[280px] lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Main navigation"
      >
        {/* Brand */}
        <div className={cn('flex h-16 items-center border-b border-line px-4', collapsed && 'lg:justify-center lg:px-0')}>
          <NavLink to="/dashboard" className="group flex min-w-0 items-center gap-2.5" onClick={onCloseMobile}>
            <span className="relative grid size-9 shrink-0 place-items-center rounded-xl bg-[linear-gradient(145deg,#38BDF8,#6366F1)] text-white shadow-[0_8px_24px_-10px_rgb(56_189_248/0.9)]">
              <Snowflake className="size-5" strokeWidth={2.2} />
            </span>
            <span className={cn('min-w-0 transition-opacity duration-200', collapsed && 'lg:hidden')}>
              <span className="block text-[15px] leading-tight font-semibold tracking-tight text-fg">
                CoolSense
              </span>
              <span className="block text-[10px] font-medium tracking-[0.16em] text-muted uppercase">
                AC Intelligence
              </span>
            </span>
          </NavLink>
          <button
            type="button"
            onClick={onCloseMobile}
            className="ml-auto rounded-lg p-1.5 text-muted transition hover:bg-card-2 hover:text-fg lg:hidden"
            aria-label="Close navigation"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="hide-scrollbar flex-1 overflow-y-auto px-2.5 py-4" aria-label="Workspace">
          <p
            className={cn(
              'mb-1.5 px-2.5 text-[9.5px] font-semibold tracking-[0.16em] text-muted/80 uppercase',
              collapsed && 'lg:hidden',
            )}
          >
            Workspace
          </p>
          <ul className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const link = (
                <NavLink
                  to={item.path}
                  onClick={onCloseMobile}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[12.5px] font-medium transition-all duration-150',
                      collapsed && 'lg:justify-center lg:px-0',
                      isActive ? 'bg-accent-soft text-fg' : 'text-muted hover:bg-card-2 hover:text-fg',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          'absolute left-0 h-4 w-[2px] rounded-r-full bg-accent transition-opacity',
                          isActive ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <Icon
                        className={cn(
                          'size-4 shrink-0 transition-colors',
                          isActive ? 'text-accent' : 'text-muted group-hover:text-fg-soft',
                        )}
                        strokeWidth={isActive ? 2.2 : 1.9}
                      />
                      <span className={cn('truncate', collapsed && 'lg:hidden')}>{item.label}</span>
                      {item.path === '/simulation' && !collapsed ? (
                        <Badge tone="accent" className="ml-auto hidden xl:inline-flex">
                          LAB
                        </Badge>
                      ) : null}
                    </>
                  )}
                </NavLink>
              )
              return (
                <li key={item.path}>
                  {collapsed ? (
                    <Tooltip label={item.label} side="right">
                      {link}
                    </Tooltip>
                  ) : (
                    link
                  )}
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-line p-2.5">
          <div
            className={cn(
              'mb-2 rounded-xl border border-line bg-card-2 p-3',
              collapsed && 'lg:hidden',
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">
                Tariff
              </span>
              <span className="tnum text-[11px] font-semibold text-accent">
                ${settings.pricePerKwh.toFixed(2)}/kWh
              </span>
            </div>
            <p className="mt-1 text-[10.5px] leading-4 text-muted">
              Used for every cost estimate in the workspace.
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleCollapse}
            className={cn(
              'hidden h-8 w-full items-center gap-2 rounded-lg px-2.5 text-[11.5px] font-medium text-muted transition hover:bg-card-2 hover:text-fg lg:flex',
              collapsed && 'justify-center px-0',
            )}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeft
              className={cn('size-3.5 transition-transform duration-300', collapsed && 'rotate-180')}
            />
            <span className={cn(collapsed && 'hidden')}>Collapse</span>
          </button>
        </div>
      </aside>
    </>
  )
}
