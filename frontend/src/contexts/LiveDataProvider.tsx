import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useQuery } from '@tanstack/react-query'
import type { AcDevice, Activity, ConnectionState } from '@/types'
import { listDevices } from '@/api/devices.api'
import { listActivities } from '@/api/activities.api'
import { getThingsBoardStatus } from '@/api/thingsboard.api'
import { socketService } from '@/services/socket'
import { useSettings } from './SettingsProvider'

interface LiveDataContextValue {
  devices: AcDevice[]
  activities: Activity[]
  isLoading: boolean
  error: string | null
  refetch: () => void
  connection: ConnectionState
  thingsboard: ConnectionState
  getDevice: (id: string | undefined) => AcDevice | undefined
  replaceDevice: (device: AcDevice) => void
  removeDevice: (id: string) => void
}

const LiveDataContext = createContext<LiveDataContextValue | null>(null)

export function LiveDataProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings()
  const [devices, setDevices] = useState<AcDevice[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [connection, setConnection] = useState<ConnectionState>('connecting')
  const [thingsboard, setThingsboard] = useState<ConnectionState>('connecting')

  const devicesQuery = useQuery({
    queryKey: ['devices'],
    queryFn: listDevices,
    staleTime: 15_000,
  })

  const activitiesQuery = useQuery({
    queryKey: ['activities'],
    queryFn: listActivities,
    staleTime: 30_000,
  })

  const tbQuery = useQuery({
    queryKey: ['thingsboard-status', settings.pricePerKwh],
    queryFn: getThingsBoardStatus,
    staleTime: 20_000,
  })

  // Seed local state from the initial fetch.
  useEffect(() => {
    if (devicesQuery.data) setDevices(devicesQuery.data)
  }, [devicesQuery.data])

  useEffect(() => {
    if (activitiesQuery.data) setActivities(activitiesQuery.data)
  }, [activitiesQuery.data])

  useEffect(() => {
    if (tbQuery.data) setThingsboard(tbQuery.data.connected ? 'connected' : 'disconnected')
  }, [tbQuery.data])

  // Single socket connection for the authenticated session.
  useEffect(() => {
    socketService.connect()

    const offStatus = socketService.onStatus(setConnection)
    const offDevice = socketService.on('device:updated', (device) => {
      setDevices((prev) => {
        const index = prev.findIndex((d) => d.id === device.id)
        if (index === -1) return [...prev, device]
        const next = prev.slice()
        next[index] = device
        return next
      })
    })
    const offDeleted = socketService.on('device:deleted', ({ id }) => {
      setDevices((prev) => prev.filter((d) => d.id !== id))
    })
    const offActivity = socketService.on('activity:new', (activity) => {
      setActivities((prev) => [activity, ...prev.filter((a) => a.id !== activity.id)].slice(0, 60))
    })
    const offTb = socketService.on('thingsboard:status', (status) => {
      setThingsboard(status.connected ? 'connected' : 'disconnected')
    })

    return () => {
      offStatus()
      offDevice()
      offDeleted()
      offActivity()
      offTb()
      socketService.disconnect()
    }
  }, [])

  const replaceDevice = useCallback((device: AcDevice) => {
    setDevices((prev) => prev.map((d) => (d.id === device.id ? device : d)))
  }, [])

  const removeDevice = useCallback((id: string) => {
    setDevices((prev) => prev.filter((d) => d.id !== id))
  }, [])

  const getDevice = useCallback(
    (id: string | undefined) => (id ? devices.find((d) => d.id === id) : undefined),
    [devices],
  )

  const refetch = useCallback(() => {
    void devicesQuery.refetch()
    void activitiesQuery.refetch()
    void tbQuery.refetch()
  }, [devicesQuery, activitiesQuery, tbQuery])

  const value = useMemo<LiveDataContextValue>(
    () => ({
      devices,
      activities,
      isLoading: devicesQuery.isLoading && devices.length === 0,
      error: devicesQuery.error ? (devicesQuery.error as Error).message : null,
      refetch,
      connection,
      thingsboard,
      getDevice,
      replaceDevice,
      removeDevice,
    }),
    [
      devices,
      activities,
      devicesQuery.isLoading,
      devicesQuery.error,
      refetch,
      connection,
      thingsboard,
      getDevice,
      replaceDevice,
      removeDevice,
    ],
  )

  return <LiveDataContext.Provider value={value}>{children}</LiveDataContext.Provider>
}

export function useLiveData(): LiveDataContextValue {
  const ctx = useContext(LiveDataContext)
  if (!ctx) throw new Error('useLiveData must be used inside LiveDataProvider')
  return ctx
}
