import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  CloudSun,
  FlaskConical,
  Layers,
  Ruler,
  Snowflake,
  Sparkles,
  Sun,
  ThermometerSnowflake,
  Wind,
  Zap,
} from 'lucide-react'
import type { AcMode, FanSpeed, SimulationSample, SimulationSession } from '@/types'
import {
  getSimulation,
  getSimulationSeries,
  pauseSimulation,
  resetSimulation,
  resumeSimulation,
  setSimulationSpeed,
  startSimulation,
  stopSimulation,
  updateSimulationEnvironment,
} from '@/api/simulation.api'
import { getDeviceHistory } from '@/api/devices.api'
import { sendControl } from '@/api/control.api'
import { errorMessage } from '@/api/axios'
import { socketService } from '@/services/socket'
import { useLiveData } from '@/contexts/LiveDataProvider'
import { useSettings } from '@/contexts/SettingsProvider'
import { useToast } from '@/contexts/ToastProvider'
import { cn, formatTemp } from '@/utils/format'
import { PageHeader } from '@/components/common/PageHeader'
import { Card, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { Select } from '@/components/common/Select'
import { Badge, StatusDot } from '@/components/common/Badge'
import { DataSourceBadge, EmptyState } from '@/components/common/States'
import { Slider } from '@/components/common/Slider'
import { SimulationControls } from '@/components/simulation/SimulationControls'
import { RoomVisualization } from '@/components/simulation/RoomVisualization'
import { SimulationCharts } from '@/components/simulation/SimulationCharts'
import { SimulationStatus } from '@/components/simulation/SimulationStatus'
import { EnvironmentControls } from '@/components/simulation/EnvironmentControls'
import { ACModeSelector } from '@/components/control/ACModeSelector'
import { ACFanControl } from '@/components/control/ACFanControl'

interface Preset {
  id: string
  label: string
  detail: string
  icon: typeof Sun
  patch?: Parameters<typeof updateSimulationEnvironment>[1]
  target?: number
  speed?: number
}

const PRESETS: Preset[] = [
  { id: 'heatwave', label: 'Heatwave', detail: '44 °C outside', icon: Sun, patch: { outsideTempC: 44 } },
  { id: 'mild', label: 'Mild day', detail: '26 °C outside', icon: CloudSun, patch: { outsideTempC: 26 } },
  { id: 'small', label: 'Small room', detail: '10 m² · fast pull-down', icon: Ruler, patch: { areaM2: 10 } },
  { id: 'large', label: 'Large room', detail: '70 m² · slow pull-down', icon: Layers, patch: { areaM2: 70 } },
  { id: 'poor', label: 'Leaky envelope', detail: 'Poor insulation', icon: Wind, patch: { insulation: 'poor' } },
  { id: 'passive', label: 'Passive house', detail: 'Excellent insulation', icon: Sparkles, patch: { insulation: 'excellent' } },
  { id: 'eco', label: 'Eco setpoint', detail: 'Target 26 °C', icon: ThermometerSnowflake, target: 26 },
  { id: 'deep', label: 'Deep cool', detail: 'Target 18 °C', icon: Snowflake, target: 18 },
]

export function SimulationPage() {
  const { devices, getDevice, isLoading } = useLiveData()
  const { settings } = useSettings()
  const { toast } = useToast()
  const [params, setParams] = useSearchParams()

  const [session, setSession] = useState<SimulationSession | null>(null)
  const [series, setSeries] = useState<SimulationSample[]>([])
  const [speed, setSpeed] = useState(settings.simulationSpeed)
  const [busy, setBusy] = useState(false)

  const selectedId = params.get('device') ?? session?.deviceId ?? devices[0]?.id
  const device = getDevice(selectedId)

  const [target, setTarget] = useState<number>(device?.state.targetTempC ?? settings.defaultTargetTempC)
  const [fanSpeed, setFanSpeed] = useState<FanSpeed>(device?.state.fanSpeed ?? 'auto')
  const [mode, setMode] = useState<AcMode>(device?.state.mode ?? 'cool')

  useEffect(() => {
    if (!device) return
    setTarget(device.state.targetTempC)
    setFanSpeed(device.state.fanSpeed)
    setMode(device.state.mode)
  }, [device?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  /* initial session + live socket stream */
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const current = await getSimulation()
        if (cancelled) return
        setSession(current)
        if (current) {
          setSpeed(current.speed)
          const samples = await getSimulationSeries()
          if (!cancelled) setSeries(samples)
        }
      } catch {
        /* the simulation can legitimately have no session yet */
      }
    })()

    const offUpdate = socketService.on('simulation:update', (update) => {
      setSession(update.session)
      setSeries((prev) => [...prev, update.sample].slice(-420))
    })
    const offLifecycle = (lifecycleSession: SimulationSession) => setSession(lifecycleSession)
    const offStarted = socketService.on('simulation:started', (lifecycleSession) => {
      setSeries([])
      offLifecycle(lifecycleSession)
    })
    const offPaused = socketService.on('simulation:paused', offLifecycle)
    const offResumed = socketService.on('simulation:resumed', offLifecycle)
    const offStopped = socketService.on('simulation:stopped', offLifecycle)

    return () => {
      cancelled = true
      offUpdate()
      offStarted()
      offPaused()
      offResumed()
      offStopped()
    }
  }, [])

  /* baseline history when no session samples exist */
  const historyQuery = useQuery({
    queryKey: ['simulation-baseline', device?.id],
    queryFn: () => getDeviceHistory(device?.id ?? '', 3_600, 80),
    enabled: Boolean(device?.id),
    staleTime: 60_000,
  })

  const baselineSeries = useMemo(
    () =>
      (historyQuery.data ?? []).map((sample) => ({
        ...sample,
      })),
    [historyQuery.data],
  )

  const running = session?.status === 'running'
  const liveSeries = series.length > 0 ? series : baselineSeries
  const isStreaming = series.length > 0 && (running || session?.status === 'paused')

  const patchEnvironment = useCallback(
    async (patch: Parameters<typeof updateSimulationEnvironment>[1]) => {
      if (!device) return
      try {
        await updateSimulationEnvironment(device.id, patch)
      } catch (error) {
        toast({ title: 'Could not update the room', description: errorMessage(error), variant: 'error' })
      }
    },
    [device, toast],
  )

  const changeSpeed = async (next: number) => {
    setSpeed(next)
    if (session) {
      try {
        await setSimulationSpeed(next)
        toast({ title: `Simulation speed ×${next}`, variant: 'info' })
      } catch (error) {
        toast({ title: 'Speed change failed', description: errorMessage(error), variant: 'error' })
      }
    }
  }

  const handleStart = async () => {
    if (!device) return
    setBusy(true)
    try {
      const next = await startSimulation({
        deviceId: device.id,
        speed,
        environment: device.environment,
        targetTempC: target,
        fanSpeed,
        mode,
      })
      setSession(next)
      setSeries([])
      toast({
        title: 'Simulation started',
        description: `${device.name} running at ×${speed} simulated speed.`,
        variant: 'success',
      })
    } catch (error) {
      toast({ title: 'Could not start simulation', description: errorMessage(error), variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const lifecycle = async (action: 'pause' | 'resume' | 'stop' | 'reset') => {
    setBusy(true)
    try {
      const map = {
        pause: pauseSimulation,
        resume: resumeSimulation,
        stop: stopSimulation,
        reset: resetSimulation,
      } as const
      const next = await map[action]()
      setSession(next)
      if (action === 'reset') setSeries([])
      toast({
        title:
          action === 'pause'
            ? 'Simulation paused'
            : action === 'resume'
              ? 'Simulation resumed'
              : action === 'stop'
                ? 'Simulation stopped'
                : 'Simulation reset',
        variant: action === 'stop' ? 'info' : 'success',
      })
    } catch (error) {
      toast({ title: 'Action failed', description: errorMessage(error), variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const applyPreset = async (preset: Preset) => {
    if (!device) return
    try {
      if (preset.patch) await updateSimulationEnvironment(device.id, preset.patch)
      if (preset.target != null) {
        await sendControl(device.id, { targetTempC: preset.target })
        setTarget(preset.target)
      }
      if (preset.speed != null) await changeSpeed(preset.speed)
      toast({ title: `${preset.label} applied`, description: preset.detail, variant: 'success' })
    } catch (error) {
      toast({ title: 'Preset failed', description: errorMessage(error), variant: 'error' })
    }
  }

  const resetDefaults = async () => {
    if (!device) return
    try {
      await updateSimulationEnvironment(device.id, {
        outsideTempC: settings.defaultOutsideTempC,
        roomTempC: settings.defaultRoomTempC,
        humidityPct: settings.defaultHumidityPct,
        areaM2: 22,
        insulation: 'average',
        occupancy: 1,
        windowExposure: 0.3,
        heatGainW: 150,
      })
      await sendControl(device.id, {
        targetTempC: settings.defaultTargetTempC,
        fanSpeed: 'auto',
        mode: 'cool',
      })
      setTarget(settings.defaultTargetTempC)
      setFanSpeed('auto')
      setMode('cool')
      setSpeed(settings.simulationSpeed)
      toast({ title: 'Defaults restored', description: 'Room and AC configuration reset.', variant: 'success' })
    } catch (error) {
      toast({ title: 'Reset failed', description: errorMessage(error), variant: 'error' })
    }
  }

  const changeTarget = async (value: number) => {
    setTarget(value)
    if (!device) return
    try {
      await sendControl(device.id, { targetTempC: value })
    } catch (error) {
      toast({ title: 'Set point rejected', description: errorMessage(error), variant: 'error' })
    }
  }

  if (isLoading || !device) {
    return (
      <div className="space-y-5">
        <PageHeader title="Simulation Laboratory" description="Loading the simulation workspace…" />
        <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
          <div className="h-[420px] animate-pulse rounded-2xl bg-card-2" />
          <div className="h-[420px] animate-pulse rounded-2xl bg-card-2" />
        </div>
      </div>
    )
  }

  if (devices.length === 0) {
    return (
      <EmptyState
        icon={<FlaskConical className="size-6" />}
        title="The lab needs a device"
        description="Register a virtual AC to start experimenting with room physics, compressor behaviour and energy."
        action={
          <Link to="/devices">
            <Button variant="primary">Add a device</Button>
          </Link>
        }
      />
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-2">
            <StatusDot tone={running ? 'success' : 'neutral'} pulse={running} />
            Physics lab · real-time engine
          </span>
        }
        title="Simulation Laboratory"
        description="Change the room, the weather and the compressor, then watch the thermodynamics unfold in real time."
        actions={
          <>
            <DataSourceBadge source="mock" />
            <Select
              value={device.id}
              onChange={(event) => setParams({ device: event.target.value }, { replace: true })}
              className="h-9 w-[200px]"
              aria-label="Simulation device"
              options={devices.map((d) => ({ value: d.id, label: d.name }))}
            />
          </>
        }
      />

      <SimulationControls
        session={session}
        speed={speed}
        busy={busy}
        canStart={Boolean(device)}
        onStart={handleStart}
        onPause={() => void lifecycle('pause')}
        onResume={() => void lifecycle('resume')}
        onStop={() => void lifecycle('stop')}
        onReset={() => void lifecycle('reset')}
        onSpeedChange={(next) => void changeSpeed(next)}
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader
              title="Virtual room"
              description={`${device.environment.roomName} · ${device.environment.areaM2} m² · ${device.environment.occupancy} occupants`}
              icon={<FlaskConical className="size-4" />}
              action={
                <div className="flex items-center gap-1.5">
                  <Badge tone={device.state.compressorOn ? 'accent' : 'neutral'} dot>
                    {device.state.compressorOn ? 'Cooling' : 'Idle'}
                  </Badge>
                  <Badge tone="neutral">{device.inverter ? 'Inverter' : 'Fixed'}</Badge>
                </div>
              }
            />
            <div className="p-3 sm:p-4">
              <RoomVisualization device={device} running={Boolean(running)} />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Live telemetry"
              description={isStreaming ? 'Streaming samples from the simulation session' : 'Baseline history — start a session to stream live'}
              icon={<Zap className="size-4" />}
              action={
                <Badge tone={isStreaming ? 'success' : 'neutral'} dot>
                  {isStreaming ? 'LIVE' : 'BASELINE'}
                </Badge>
              }
            />
            <div className="p-4">
              <SimulationCharts series={liveSeries} live={isStreaming} height={252} />
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Session"
              description="Simulation engine state"
              icon={<ThermometerSnowflake className="size-4" />}
              action={<Badge tone={running ? 'success' : 'neutral'}>{running ? 'Running' : 'Idle'}</Badge>}
            />
            <SimulationStatus session={session} device={device} sampleCount={series.length} />
          </Card>

          <Card>
            <CardHeader title="AC configuration" description="Applies to the live unit" icon={<Snowflake className="size-4" />} />
            <div className="space-y-4 p-4">
              <Slider
                label="Target temperature"
                value={target}
                min={device.targetRange[0]}
                max={device.targetRange[1]}
                step={0.5}
                unit="°C"
                hint={`Current room ${formatTemp(device.state.roomTempC, settings.temperatureUnit)}`}
                onChange={setTarget}
                onCommit={(value) => void changeTarget(value)}
              />
              <ACModeSelector
                value={mode}
                supportsHeating={device.supportsHeating}
                onChange={(next) => {
                  setMode(next)
                  void sendControl(device.id, { mode: next }).catch((error) =>
                    toast({ title: 'Mode rejected', description: errorMessage(error), variant: 'error' }),
                  )
                }}
              />
              <ACFanControl
                value={fanSpeed}
                onChange={(next) => {
                  setFanSpeed(next)
                  void sendControl(device.id, { fanSpeed: next }).catch((error) =>
                    toast({ title: 'Fan change rejected', description: errorMessage(error), variant: 'error' }),
                  )
                }}
              />
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-line bg-card-2/60 p-2.5">
                <Spec label="Cooling capacity" value={`${device.coolingCapacityKw} kW`} />
                <Spec label="Rated power" value={`${device.ratedPowerW} W`} />
                <Spec label="Compressor" value={device.inverter ? 'Inverter' : 'Fixed speed'} />
                <Spec label="Heating" value={device.supportsHeating ? 'Supported' : 'None'} />
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader
            title="Room environment"
            description="Every change is pushed to the engine and applied on the next physics step"
            icon={<Wind className="size-4" />}
            action={<span className="text-[10px] text-muted">live</span>}
          />
          <div className="p-4">
            <EnvironmentControls device={device} onPatch={patchEnvironment} />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Experiment presets"
            description="Jump between scenarios to compare behaviour"
            icon={<Sparkles className="size-4" />}
            action={
              <Button size="xs" variant="ghost" onClick={resetDefaults}>
                Reset defaults
              </Button>
            }
          />
          <div className="grid grid-cols-2 gap-2 p-4">
            {PRESETS.map((preset) => {
              const Icon = preset.icon
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => void applyPreset(preset)}
                  className={cn(
                    'group flex items-center gap-2 rounded-lg border border-line bg-card-2/60 p-2.5 text-left transition',
                    'hover:border-accent/40 hover:bg-accent-soft/50',
                  )}
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-md border border-line bg-card text-accent transition group-hover:border-accent/30">
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-semibold text-fg">{preset.label}</span>
                    <span className="block truncate text-[9.5px] text-muted">{preset.detail}</span>
                  </span>
                </button>
              )
            })}
          </div>
          <p className="border-t border-line px-4 py-3 text-[10px] leading-4 text-muted">
            Presets adjust the simulated room or set point instantly. Results are model estimates —
            real installations vary with construction, refrigerant charge and airflow.
          </p>
        </Card>
      </div>
    </div>
  )
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-0.5 text-[11px] font-semibold text-fg-soft">{value}</p>
    </div>
  )
}
