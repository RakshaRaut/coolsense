import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthProvider'
import { LiveDataProvider } from '@/contexts/LiveDataProvider'
import { AppLayout } from '@/layouts/AppLayout'

const LoginPage = lazy(() => import('@/pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })))
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const DevicesPage = lazy(() => import('@/pages/devices/DevicesPage').then((m) => ({ default: m.DevicesPage })))
const DeviceDetailPage = lazy(() =>
  import('@/pages/devices/DeviceDetailPage').then((m) => ({ default: m.DeviceDetailPage })),
)
const ControlPage = lazy(() => import('@/pages/control/ControlPage').then((m) => ({ default: m.ControlPage })))
const SimulationPage = lazy(() =>
  import('@/pages/simulation/SimulationPage').then((m) => ({ default: m.SimulationPage })),
)
const AnalyticsPage = lazy(() =>
  import('@/pages/analytics/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })),
)
const ThingsBoardPage = lazy(() =>
  import('@/pages/thingsboard/ThingsBoardPage').then((m) => ({ default: m.ThingsBoardPage })),
)
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })))

function RouteFallback() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="size-6 animate-spin text-accent" />
        <p className="text-[11.5px] text-muted">Loading CoolSense…</p>
      </div>
    </div>
  )
}

function ProtectedRoute() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return <Outlet />
}

function PublicOnlyRoute() {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

function AuthenticatedShell() {
  return (
    <LiveDataProvider>
      <AppLayout />
    </LiveDataProvider>
  )
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AuthenticatedShell />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/devices" element={<DevicesPage />} />
            <Route path="/devices/:id" element={<DeviceDetailPage />} />
            <Route path="/control" element={<ControlPage />} />
            <Route path="/simulation" element={<SimulationPage />} />
            <Route path="/comparison" element={<Navigate to="/analytics" replace />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/thingsboard" element={<ThingsBoardPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
