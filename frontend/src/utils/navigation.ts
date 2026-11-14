import {
  AirVent,
  BarChart3,
  FlaskConical,
  LayoutDashboard,
  Radio,
  Settings2,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  description: string
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
    description: 'Room climate, compressor state and energy at a glance',
  },
  {
    label: 'AC Devices',
    path: '/devices',
    icon: AirVent,
    description: 'Virtual units, AC models and inverter types',
  },
  {
    label: 'AC Control',
    path: '/control',
    icon: SlidersHorizontal,
    description: 'Power, set point, mode and fan speed for a selected unit',
  },
  {
    label: 'Simulation',
    path: '/simulation',
    icon: FlaskConical,
    description: 'Room physics, compressor behaviour and simulation speed',
  },
  {
    label: 'Analytics',
    path: '/analytics',
    icon: BarChart3,
    description: 'Temperature history, energy, cost and inverter comparison',
  },
  {
    label: 'ThingsBoard',
    path: '/thingsboard',
    icon: Radio,
    description: 'Telemetry integration and device synchronisation',
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: Settings2,
    description: 'Preferences, simulation defaults and electricity tariff',
  },
]

export function navItemFor(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`))
}
