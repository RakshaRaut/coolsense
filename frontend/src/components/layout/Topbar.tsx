import { useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings2,
  Sun,
  UserRound,
} from 'lucide-react'
import { cn, formatRelative, formatTimeWithSeconds } from '@/utils/format'
import { IS_MOCK } from '@/utils/constants'
import { NAV_ITEMS, navItemFor } from '@/utils/navigation'
import { useAuth } from '@/contexts/AuthProvider'
import { useLiveData } from '@/contexts/LiveDataProvider'
import { useSettings } from '@/contexts/SettingsProvider'
import { useClickOutside } from '@/hooks/useClickOutside'
import { Badge, StatusDot } from '@/components/common/Badge'
import { Tooltip } from '@/components/common/PageHeader'

interface TopbarProps {
  onOpenMobileNav: () => void
}

export function Topbar({ onOpenMobileNav }: TopbarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { settings, toggleTheme } = useSettings()
  const { connection, thingsboard, activities, devices } = useLiveData()

  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const searchRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  useClickOutside(searchRef, () => setSearchOpen(false), searchOpen)
  useClickOutside(notifRef, () => setNotifOpen(false), notifOpen)
  useClickOutside(profileRef, () => setProfileOpen(false), profileOpen)

  const current = navItemFor(location.pathname)
  const isDeviceDetail = location.pathname.startsWith('/devices/')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return { pages: NAV_ITEMS.slice(0, 4), devices: devices.slice(0, 3) }
    return {
      pages: NAV_ITEMS.filter(
        (item) =>
          item.label.toLowerCase().includes(q) || item.description.toLowerCase().includes(q),
      ).slice(0, 4),
      devices: devices
        .filter(
          (device) =>
            device.name.toLowerCase().includes(q) ||
            device.environment.roomName.toLowerCase().includes(q) ||
            device.modelName.toLowerCase().includes(q),
        )
        .slice(0, 4),
    }
  }, [query, devices])

  const go = (path: string) => {
    navigate(path)
    setQuery('')
    setSearchOpen(false)
  }

  const initials = (user?.name ?? 'CS')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const backendTone = connection === 'connected' ? 'success' : connection === 'connecting' ? 'warning' : 'danger'
  const tbTone = thingsboard === 'connected' ? 'success' : thingsboard === 'connecting' ? 'warning' : 'danger'

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="-ml-1 rounded-lg p-2 text-muted transition hover:bg-card-2 hover:text-fg lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="size-5" />
        </button>

        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[12px]">
          <Link to="/dashboard" className="hidden text-muted transition hover:text-fg sm:inline">
            CoolSense
          </Link>
          <ChevronRight className="hidden size-3 text-muted/60 sm:inline" />
          <span className="truncate font-medium text-fg">
            {isDeviceDetail ? 'Devices' : (current?.label ?? 'Overview')}
          </span>
          {isDeviceDetail ? (
            <>
              <ChevronRight className="size-3 text-muted/60" />
              <span className="truncate text-muted">Details</span>
            </>
          ) : null}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {/* Search */}
          <div ref={searchRef} className="relative hidden lg:block">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setSearchOpen(true)
                }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    const first = results.devices[0]
                    if (first) go(`/devices/${first.id}`)
                    else if (results.pages[0]) go(results.pages[0].path)
                  }
                }}
                placeholder="Search devices, pages…"
                aria-label="Global search"
                className="h-8.5 w-56 rounded-lg border border-line bg-card-2 pr-3 pl-8 text-[12px] text-fg placeholder:text-muted/80 transition focus:w-72 focus:border-accent/60 focus:bg-card focus:ring-4 focus:ring-accent/10 focus:outline-none"
              />
            </div>
            {searchOpen ? (
              <div className="absolute top-full left-0 z-50 mt-2 w-80 animate-fade-in overflow-hidden rounded-xl border border-line bg-elevated shadow-pop">
                {results.devices.length > 0 ? (
                  <div className="p-1.5">
                    <p className="px-2 py-1 text-[9.5px] font-semibold tracking-[0.14em] text-muted uppercase">
                      Devices
                    </p>
                    {results.devices.map((device) => (
                      <button
                        key={device.id}
                        type="button"
                        onClick={() => go(`/devices/${device.id}`)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-card-2"
                      >
                        <span className="grid size-6 place-items-center rounded-md bg-accent-soft text-[10px] font-semibold text-accent">
                          {device.name.slice(0, 1)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-medium text-fg">{device.name}</span>
                          <span className="block truncate text-[10.5px] text-muted">
                            {device.environment.roomName} · {device.modelName}
                          </span>
                        </span>
                        <StatusDot tone={device.state.online ? 'success' : 'neutral'} />
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="border-t border-line p-1.5">
                  <p className="px-2 py-1 text-[9.5px] font-semibold tracking-[0.14em] text-muted uppercase">
                    Pages
                  </p>
                  {results.pages.map((item) => {
                    const Icon = item.icon
                    return (
                      <button
                        key={item.path}
                        type="button"
                        onClick={() => go(item.path)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-card-2"
                      >
                        <Icon className="size-3.5 text-muted" />
                        <span className="text-[12px] font-medium text-fg">{item.label}</span>
                      </button>
                    )
                  })}
                  {results.pages.length === 0 && results.devices.length === 0 ? (
                    <p className="px-2 py-3 text-center text-[11.5px] text-muted">No matches found</p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          {/* Connection status */}
          <div className="hidden items-center gap-1.5 md:flex">
            <Tooltip label={`Backend ${connection} · updated ${formatTimeWithSeconds(Date.now())}`}>
              <span className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-card-2 px-2 text-[10.5px] font-medium text-muted">
                <StatusDot tone={backendTone} pulse={connection === 'connected'} />
                <span className="hidden xl:inline">Backend</span>
              </span>
            </Tooltip>
            <Tooltip label={`ThingsBoard ${thingsboard}`}>
              <span className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-card-2 px-2 text-[10.5px] font-medium text-muted">
                <StatusDot tone={tbTone} pulse={thingsboard === 'connected'} />
                <span className="hidden xl:inline">ThingsBoard</span>
              </span>
            </Tooltip>
            {IS_MOCK ? (
              <Badge tone="warning" className="hidden xl:inline-flex">
                MOCK DATA
              </Badge>
            ) : null}
          </div>

          <div className="mx-0.5 hidden h-6 w-px bg-line md:block" />

          {/* Theme */}
          <Tooltip label={settings.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
            <button
              type="button"
              onClick={toggleTheme}
              className="grid size-9 place-items-center rounded-lg text-muted transition hover:bg-card-2 hover:text-fg"
              aria-label="Toggle theme"
            >
              {settings.theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
          </Tooltip>

          {/* Notifications */}
          <div ref={notifRef} className="relative">
            <button
              type="button"
              onClick={() => setNotifOpen((v) => !v)}
              className={cn(
                'relative grid size-9 place-items-center rounded-lg text-muted transition hover:bg-card-2 hover:text-fg',
                notifOpen && 'bg-card-2 text-fg',
              )}
              aria-label="Notifications"
              aria-expanded={notifOpen}
            >
              <Bell className="size-4" />
              {activities.length > 0 ? (
                <span className="absolute top-2 right-2 size-1.5 rounded-full bg-accent ring-2 ring-bg" />
              ) : null}
            </button>
            {notifOpen ? (
              <div className="absolute top-full right-0 z-50 mt-2 w-[320px] animate-fade-in overflow-hidden rounded-xl border border-line bg-elevated shadow-pop">
                <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
                  <p className="text-[12px] font-semibold text-fg">Recent activity</p>
                  <Badge tone="neutral">{activities.length}</Badge>
                </div>
                <ul className="hide-scrollbar max-h-80 overflow-y-auto p-1.5">
                  {activities.slice(0, 6).map((activity) => (
                    <li key={activity.id} className="rounded-lg px-2 py-2 transition hover:bg-card-2">
                      <p className="text-[11.5px] leading-4 text-fg-soft">{activity.message}</p>
                      <p className="mt-0.5 text-[10px] text-muted">
                        {activity.deviceName ? `${activity.deviceName} · ` : ''}
                        {formatRelative(activity.at)}
                      </p>
                    </li>
                  ))}
                  {activities.length === 0 ? (
                    <li className="px-2 py-6 text-center text-[11.5px] text-muted">No activity yet</li>
                  ) : null}
                </ul>
                <p className="border-t border-line px-3.5 py-2.5 text-center text-[10.5px] text-muted">
                  Control, simulation and sync events
                </p>
              </div>
            ) : null}
          </div>

          {/* Profile */}
          <div ref={profileRef} className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              className={cn(
                'flex h-9 items-center gap-2 rounded-lg pr-1.5 pl-1 transition hover:bg-card-2',
                profileOpen && 'bg-card-2',
              )}
              aria-label="Account menu"
              aria-expanded={profileOpen}
            >
              <span className="grid size-7 place-items-center rounded-lg bg-[linear-gradient(145deg,#818CF8,#38BDF8)] text-[10.5px] font-bold text-white">
                {initials}
              </span>
              <span className="hidden max-w-28 truncate text-[12px] font-medium text-fg sm:block">
                {user?.name ?? 'Guest'}
              </span>
              <ChevronDown className="hidden size-3.5 text-muted sm:block" />
            </button>
            {profileOpen ? (
              <div className="absolute top-full right-0 z-50 mt-2 w-60 animate-fade-in overflow-hidden rounded-xl border border-line bg-elevated shadow-pop">
                <div className="border-b border-line px-3.5 py-3">
                  <p className="truncate text-[12.5px] font-semibold text-fg">{user?.name}</p>
                  <p className="truncate text-[11px] text-muted">{user?.email}</p>
                  <Badge tone="accent" className="mt-2">
                    {user?.role?.toUpperCase()}
                  </Badge>
                </div>
                <div className="p-1.5">
                  <Link
                    to="/settings"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-2 py-2 text-[12px] text-fg-soft transition hover:bg-card-2 hover:text-fg"
                  >
                    <UserRound className="size-3.5 text-muted" />
                    Profile & preferences
                  </Link>
                  <Link
                    to="/settings"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-2 py-2 text-[12px] text-fg-soft transition hover:bg-card-2 hover:text-fg"
                  >
                    <Settings2 className="size-3.5 text-muted" />
                    Workspace settings
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false)
                      void logout()
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[12px] text-danger transition hover:bg-danger-soft"
                  >
                    <LogOut className="size-3.5" />
                    Sign out
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
}
