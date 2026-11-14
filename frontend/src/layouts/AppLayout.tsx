import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { cn } from '@/utils/format'
import { readStore, writeStore } from '@/services/mock/storage'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { MobileNavigation } from '@/components/layout/MobileNavigation'

export function AppLayout() {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState<boolean>(() => readStore<boolean>('sidebar-collapsed') ?? false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    writeStore('sidebar-collapsed', collapsed)
  }, [collapsed])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="min-h-dvh bg-bg">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div
        className={cn(
          'flex min-h-dvh flex-col transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
          collapsed ? 'lg:pl-[84px]' : 'lg:pl-[264px]',
        )}
      >
        <Topbar onOpenMobileNav={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-[1560px] flex-1 px-4 pt-5 pb-24 sm:px-6 sm:pt-6 lg:px-8 lg:pb-10">
          <div key={location.pathname} className="animate-rise">
            <Outlet />
          </div>
        </main>
      </div>

      <MobileNavigation onOpenMore={() => setMobileOpen(true)} />
    </div>
  )
}
