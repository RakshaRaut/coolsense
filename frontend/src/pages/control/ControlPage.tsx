import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AirVent,
  ArrowLeft,
  Cpu,
  Flame,
  Moon,
  Power,
  Radio,
  Sparkles,
  ThermometerSnowflake,
  Zap,
} from 'lucide-react'
import type { AcMode, FanSpeed } from '@/types'
import { sendControl } from '@/api/control.api'
import { errorMessage } from '@/api/axios'
import { getDeviceHistory } from '@/api/devices.api'
import { useLiveData } from '@/contexts/LiveDataProvider'
import { useSettings } from '@/contexts/SettingsProvider'
import { useToast } from '@/contexts/ToastProvider'
import { DEVICE_TYPE_LABEL, INSULATION_META, MODE_META } from '@/utils/constants'
import { cn, formatEnergy, formatRelative, formatTimeWithSeconds } from '@/utils/format'
import { PageHeader } from '@/components/common/PageHeader'
import { Card, CardHeader } from '@/components/common/Card'
import { Button, buttonStyles } from '@/components/common/Button'
import { Badge, StatusDot } from '@/components/common/Badge'
import { Select } from '@/components/common/Select'
import { ErrorState, EmptyState } from '@/components/common/States'
import { ACTemperatureControl } from '@/components/control/ACTemperatureControl'
import { ACModeSelector } from '@/components/control/ACModeSelector'
import { ACFanControl } from '@/components/control/ACFanControl'
import { ACStatusPanel } from '@/components/control/ACStatusPanel'
import { TemperatureChart } from '@/components/dashboard/TemperatureChart'

export function ControlPage() {
  const { devices, getDevice, activities, isLoading, error, refetch } = useLiveData()
  const { settings } = useSettings()
  const { toast } = useToast()
  const [params, setParams] = useSearchParams()

  const selectedId = params.get('device') ?? devices[0]?.id
  const device = getDevice(selectedId)

  const [draftTarget, setDraftTarget] = useState<number | null>(null)
  const [pending, setPending] = useState<string | null>(null)

  useEffect(() => {
    setDraftTarget(null)
  }, [device?.state.targetTempC, device?.id])

  const historyQuery = useQuery({
    queryKey: ['control-history', device?.id],
    queryFn: () => getDeviceHistory(device?.id ?? '', 3_600, 60),
    enabled: Boolean(device?.id),
    refetchInterval: 30_000,
  })

  const series = useMemo(
    () =>
      (historyQuery.data ?? []).map((sample) => ({
        time: sample.time,
        roomTempC: sample.roomTempC,
        targetTempC: sample.targetTempC,
        outsideTempC: sample.outsideTempC,
        powerW: sample.powerW,
        energyKwh: sample.energyKwh,
      })),
    [historyQuery.data],
  )

  const deviceActivities = useMemo(
    () => activities.filter((activity) => activity.deviceId === device?.id).slice(0, 5),
    [activities, device?.id],
  )

  const runCommand = async (command: Parameters<typeof sendControl>[1], label: string, description?: string) => {
    if (!device) return
    setPending(label)
    try {
      await sendControl(device.id, command)
      toast({ title: label, description, variant: 'success' })
    } catch (err) {
      setDraftTarget(null)
      toast({ title: 'Command rejected', description: errorMessage(err), variant: 'error' })
    } finally {
      setPending(null)
    }
  }

  const selectDevice = (id: string) => {
    setParams({ device: id }, { replace: true })
  }

  if (isLoading) {
    return <div className="h-[600px] animate-pulse rounded-2xl bg-card-2" />
  }

  if (devices.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader title="AC Control Center" description="Drive your virtual units in real time." />
        <EmptyState
          icon={<AirVent className="size-6" />}
          title="No devices to control"
          description="Register a virtual AC first, then return here to adjust temperature, mode and fan speed."
          action={
            <Link to="/devices">
              <Button variant="primary">Go to devices</Button>
            </Link>
          }
        />
      </div>
    )
  }

  if (!device) {
    return <ErrorState message="Selected device could not be found." onRetry={refetch} />
  }

  const target = draftTarget ?? device.state.targetTempC
  const active = device.state.online && device.state.power
  const turboActive = device.state.fanSpeed === 'turbo'
  const sleepActive = device.state.fanSpeed === 'low' && device.state.power

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-2">
            <StatusDot tone={active ? 'success' : 'neutral'} pulse={active} />
            {active ? 'Live control session' : 'Standby'}
          </span>
        }
        title="AC Control Center"
        description="Every command is sent to the simulation engine and confirmed by real-time telemetry."
        actions={
          <>
            <Select
              value={device.id}
              onChange={(event) => selectDevice(event.target.value)}
              className="h-9 w-[208px]"
              aria-label="Select device"
              options={devices.map((d) => ({ value: d.id, label: d.name }))}
            />
            <Link to={`/devices/${device.id}`} className={buttonStyles('secondary', 'md')}>
              Device details
            </Link>
          </>
        }
      />

      {error ? <ErrorState message={error} onRetry={refetch} /> : null}

      <div className="grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
        {/* Remote */}
        <Card className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,var(--accent-soft),transparent_70%)]" />
          <div className="relative flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={cn(
                  'grid size-10 shrink-0 place-items-center rounded-xl border',
                  active ? 'border-accent/30 bg-accent-soft text-accent' : 'border-line bg-card-2 text-muted',
                )}
              >
                <ThermometerSnowflake className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-fg">{device.name}</p>
                <p className="truncate text-[10.5px] text-muted">
                  {device.environment.roomName} · {device.modelName}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                runCommand(
                  { power: !device.state.power },
                  device.state.power ? 'AC turned off' : 'AC turned on',
                  device.state.power ? 'Compressor ramping down.' : 'Cooling started.',
                )
              }
              disabled={!device.state.online || pending != null}
              className={cn(
                'group flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-[11.5px] font-semibold transition-all disabled:opacity-50',
                device.state.power
                  ? 'border-success/40 bg-success-soft text-success'
                  : 'border-line bg-card-2 text-muted hover:border-line-strong hover:text-fg',
              )}
              aria-pressed={device.state.power}
            >
              <span
                className={cn(
                  'grid size-5 place-items-center rounded-full transition',
                  device.state.power ? 'bg-success text-[#04140a]' : 'bg-line-strong text-muted',
                )}
              >
                <Power className="size-3" />
              </span>
              {device.state.power ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="relative space-y-6 p-5">
            <ACTemperatureControl
              target={target}
              room={device.state.roomTempC}
              min={device.targetRange[0]}
              max={device.targetRange[1]}
              active={active}
              pending={pending != null}
              unit={settings.temperatureUnit}
              onAdjust={(value) => {
                setDraftTarget(value)
                void runCommand(
                  { targetTempC: value },
                  `Target set to ${value.toFixed(1)} °C`,
                  'The unit will modulate to reach the new set point.',
                )
              }}
              onSlide={(value) => setDraftTarget(value)}
              onCommitSlide={(value) => {
                if (Math.abs(value - device.state.targetTempC) < 0.25) {
                  setDraftTarget(null)
                  return
                }
                setDraftTarget(value)
                void runCommand({ targetTempC: value }, `Target set to ${value.toFixed(1)} °C`)
              }}
            />

            <ACModeSelector
              value={device.state.mode}
              supportsHeating={device.supportsHeating}
              disabled={pending != null}
              onChange={(mode: AcMode) =>
                runCommand({ mode }, `${MODE_META[mode].label} mode selected`, MODE_META[mode].hint)
              }
            />

            <ACFanControl
              value={device.state.fanSpeed}
              disabled={pending != null}
              onChange={(fanSpeed: FanSpeed) =>
                runCommand({ fanSpeed }, `Fan speed: ${fanSpeed}`, 'Airflow adjusted on the unit.')
              }
            />

            <div>
              <p className="mb-2 text-[10px] font-semibold tracking-[0.14em] text-muted uppercase">
                Comfort profiles
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  disabled={pending != null || !device.state.online}
                  onClick={() =>
                    runCommand(
                      { fanSpeed: 'turbo' },
                      'Turbo engaged',
                      'Fan set to maximum for the fastest pull-down.',
                    )
                  }
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition disabled:opacity-40',
                    turboActive
                      ? 'border-warning/40 bg-warning-soft'
                      : 'border-line bg-card-2 hover:border-line-strong',
                  )}
                >
                  <span
                    className={cn(
                      'grid size-7 place-items-center rounded-lg',
                      turboActive ? 'bg-warning/15 text-warning' : 'bg-card text-muted',
                    )}
                  >
                    <Zap className="size-3.5" />
                  </span>
                  <span>
                    <span className="block text-[11.5px] font-semibold text-fg">Turbo</span>
                    <span className="block text-[10px] text-muted">Max airflow</span>
                  </span>
                </button>

                <button
                  type="button"
                  disabled={pending != null || !device.state.online}
                  onClick={() =>
                    runCommand(
                      { fanSpeed: 'low', targetTempC: Math.min(device.targetRange[1], device.state.targetTempC + 1) },
                      'Sleep profile applied',
                      'Fan set to low and target raised by 1 °C for quiet operation.',
                    )
                  }
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition disabled:opacity-40',
                    sleepActive ? 'border-violet/40 bg-violet-soft' : 'border-line bg-card-2 hover:border-line-strong',
                  )}
                >
                  <span
                    className={cn(
                      'grid size-7 place-items-center rounded-lg',
                      sleepActive ? 'bg-violet/15 text-violet' : 'bg-card text-muted',
                    )}
                  >
                    <Moon className="size-3.5" />
                  </span>
                  <span>
                    <span className="block text-[11.5px] font-semibold text-fg">Sleep</span>
                    <span className="block text-[10px] text-muted">Quiet + 1 °C</span>
                  </span>
                </button>
              </div>
            </div>

            {!device.state.online ? (
              <p className="rounded-lg border border-danger/25 bg-danger-soft px-3 py-2 text-[11px] text-danger">
                This unit is offline. Commands are disabled until it reconnects.
              </p>
            ) : null}
          </div>
        </Card>

        {/* Status column */}
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Unit status"
              description={`Confirmed state · ${formatTimeWithSeconds(device.state.updatedAt)}`}
              icon={<Radio className="size-4" />}
              action={
                <Badge tone={device.state.compressorOn ? 'accent' : 'neutral'} dot>
                  {device.state.compressorOn ? 'Compressing' : 'Holding'}
                </Badge>
              }
            />
            <div className="p-4">
              <ACStatusPanel device={device} />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Last hour"
              description="Room temperature against the set point"
              icon={<Sparkles className="size-4" />}
              action={<span className="tnum text-[10.5px] text-muted">{series.length} samples</span>}
            />
            <div className="p-3">
              <TemperatureChart data={series} height={168} showTarget />
            </div>
          </Card>

          <Card>
            <CardHeader title="Unit configuration" icon={<Cpu className="size-4" />} />
            <div className="divide-y divide-line">
              <InfoRow label="Location" value={device.location} />
              <InfoRow label="Type" value={DEVICE_TYPE_LABEL[device.type]} />
              <InfoRow label="Compressor" value={device.inverter ? 'Inverter' : 'Fixed speed'} />
              <InfoRow label="Cooling capacity" value={`${device.coolingCapacityKw} kW`} />
              <InfoRow label="Rated power" value={`${device.ratedPowerW} W`} />
              <InfoRow label="Insulation" value={INSULATION_META[device.environment.insulation].label} />
              <InfoRow label="Heating" value={device.supportsHeating ? 'Supported' : 'Not supported'} />
              <InfoRow
                label="Energy today"
                value={`${formatEnergy(device.state.energyKwh).value} ${formatEnergy(device.state.energyKwh).unit}`}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Recent commands"
              description="Events for this unit"
              icon={<Flame className="size-4" />}
              action={
                <Link to={`/devices/${device.id}`} className="text-[10.5px] font-medium text-accent hover:underline">
                  Details
                </Link>
              }
            />
            <ul className="divide-y divide-line">
              {deviceActivities.map((activity) => (
                <li key={activity.id} className="px-4 py-2.5">
                  <p className="text-[11.5px] leading-4 text-fg-soft">{activity.message}</p>
                  <p className="mt-0.5 text-[10px] text-muted">{formatRelative(activity.at)}</p>
                </li>
              ))}
              {deviceActivities.length === 0 ? (
                <li className="px-4 py-6 text-center text-[11px] text-muted">
                  No commands yet — adjustments appear here instantly.
                </li>
              ) : null}
            </ul>
          </Card>

          <Link
            to={`/simulation?device=${device.id}`}
            className={buttonStyles('outline', 'md', 'w-full')}
          >
            <ArrowLeft className="size-3.5 rotate-180" /> Run this unit in the simulation lab
          </Link>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2">
      <span className="text-[10.5px] text-muted">{label}</span>
      <span className="max-w-[60%] truncate text-right text-[11px] font-medium text-fg">{value}</span>
    </div>
  )
}
