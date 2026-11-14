import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AppSettings } from '@/types'
import { readStore, writeStore } from '@/services/mock/storage'
import { mockEngine } from '@/services/mock/engine'

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  temperatureUnit: 'celsius',
  energyUnit: 'kwh',
  currency: 'USD',
  defaultTimeRange: '24h',
  simulationSpeed: 30,
  defaultRoomTempC: 26,
  defaultOutsideTempC: 34,
  defaultHumidityPct: 52,
  defaultTargetTempC: 24,
  pricePerKwh: 0.24,
  includeStandbyDraw: false,
}

interface SettingsContextValue {
  settings: AppSettings
  update: (patch: Partial<AppSettings>) => void
  reset: () => void
  toggleTheme: () => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => ({
    ...DEFAULT_SETTINGS,
    ...(readStore<Partial<AppSettings>>('settings') ?? {}),
  }))

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark')
    document.documentElement.style.colorScheme = settings.theme
    writeStore('settings', settings)
    mockEngine.setPrice(settings.pricePerKwh)
  }, [settings])

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  const reset = useCallback(() => setSettings(DEFAULT_SETTINGS), [])

  const toggleTheme = useCallback(() => {
    setSettings((prev) => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }))
  }, [])

  const value = useMemo(
    () => ({ settings, update, reset, toggleTheme }),
    [settings, update, reset, toggleTheme],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider')
  return ctx
}
