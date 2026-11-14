import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Cpu,
  Droplets,
  Fan,
  Gauge,
  Home,
  Pencil,
  Power,
  SlidersHorizontal,
  Snowflake,
  Sun,
  Thermometer,
  Trash2,
  Zap,
} from 'lucide-react'
import { getDeviceHistory } from '@/api/devices.api'
import { deleteDevice } from '@/api/devices.api'
import { sendControl } from '@/api/control.api'
import { errorMessage } from '@/api/axios'
import { useLiveData } from '@/contexts/LiveDataProvider'
import { useSettings } from '@/contexts/SettingsProvider'
import { useToast } from '@/contexts/ToastProvider'
import { DEVICE_TYPE_LABEL, FAN_META, INSULATION_META, MODE_META, TIME_RANGES } from '@/utils/constants'
import {
  cn,
  formatDate,
  formatEnergy,
  formatMoney,
  formatNumber,
  formatPower,
  formatRelative,
  formatTemp,
  tempUnitLabel,
} from '@/utils/format'
import { PageHeader } from '@/components/common/PageHeader'
import { Card, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { Badge, StatusDot } from '@/components/common/Badge'
import { SegmentedControl } from '@/components/common/Select'
import { ConfirmDialog } from '@/components/common/Modal'
import { EmptyState, ErrorState, SkeletonChart } from '@/components/common/States'
import { TemperatureChart, type TimeRange } from '@/components/dashboard/TemperatureChart'
import { PowerChart } from '@/components/dashboard/PowerChart'
import { DeviceStatusBadge, CompressorBadge } from '@/components/devices/DeviceStatusBadge'
import { DeviceForm } from '@/components/devices/DeviceForm'

export function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getDevice, isLoading, removeDevice } = useLiveData()
  const { settings } = useSettings()
  const { toast } = useToast()

  const device = getDevice(id)
  const [range, setRange] = useState<TimeRange>('24h')
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const rangeSeconds = TIME_RANGES.find((r) => r.value === range)?.seconds ?? 86_400
  const historyQuery = useQuery({
    queryKey: ['device-history', id, range],
    queryFn: () => getDeviceHistory(id ?? '', rangeSeconds, 110),
    enabled: Boolean(id && device),
    refetchInterval: 20_000,
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

  const stats = useMemo(() => {
    const rows = historyQuery.data ?? []
    if (rows.length === 0) {
      return { avgPower: 0, peakPower: 0, runtimePct: 0, energy: 0, cycles: 0 }
    }
    const total = rows.length
    const avgPower = rows.reduce((a, b) => a + b.powerW, 0) / total
    const peakPower = Math.max(...rows.map((r) => r.powerW))
    const runtimePct = (rows.filter((r) => r.compressorOn).length / total) * 100
    const cycles = rows.reduce((acc, row, index) => {
      const prev = rows[index - 1]
      return acc + (prev && prev.compressorOn !== row.compressorOn ? 1 : 0)
    }, 0)
    const energy = rows.reduce((acc, row, index) => {
      const next = rows[index + 1]
      const duration = next ? (new Date(next.time).getTime() - new Date(row.time).getTime()) / 1000 : 60
      return acc + (row.powerW * duration) / 3_600_000
    }, 0)
    return { avgPower, peakPower, runtimePct, energy, cycles }
  }, [historyQuery.data])

  if (isLoading) return <SkeletonChart height={420} />

  if (!device) {
    return (
      <div className="space-y-5">
        <Link to="/devices" className="inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-fg">
          <ArrowLeft className="size-3.5" /> Back to devices
        </Link>
        <EmptyState
          icon={<Snowflake className="size-6" />}
          title="Device not found"
          description={`No virtual unit with the id "${id}" exists in this workspace. It may have been deleted.`}
          action={
            <Button variant="primary" onClick={() => navigate('/devices')}>
              Browse devices
            </Button>
          }
        />
      </div>
    )
  }

  const power = formatPower(device.state.powerW)
  const energy = formatEnergy(device.state.energyKwh)
  const ModeIcon = MODE_META[device.state.mode].icon
  const tempUnit = tempUnitLabel(settings.temperatureUnit)
  const delta = device.state.roomTempC - device.state.targetTempC

  const togglePower = async () => {
    setBusy(true)
    try {
      await sendControl(device.id, { power: !device.state.power })
      toast({ title: `AC turned ${device.state.power ? 'off' : 'on'}`, variant: 'success' })
    } catch (error) {
      toast({ title: 'Command failed', description: errorMessage(error), variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      await deleteDevice(device.id)
      removeDevice(device.id)
      toast({ title: 'Device deleted', description: `${device.name} was removed.`, variant: 'success' })
      navigate('/devices')
    } catch (error) {
      toast({ title: 'Could not delete device', description: errorMessage(error), variant: 'error' })
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          to="/devices"
          className="mb-3 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted transition hover:text-fg"
        >
          <ArrowLeft className="size-3.5" /> All devices
        </Link>
        <PageHeader
          eyebrow={
            <span className="flex items-center gap-2">
              <StatusDot tone={device.state.online ? 'success' : 'danger'} pulse={device.state.online} />
              {device.environment.roomName} · {device.key}
            </span>
          }
          title={device.name}
          description={`${device.brand} ${device.modelName} · ${DEVICE_TYPE_LABEL[device.type]} · ${
            device.inverter ? 'inverter' : 'fixed-speed'
          } compressor`}
          actions={
            <>
              <Button
                variant="secondary"
                icon={<Power className="size-3.5" />}
                loading={busy}
                disabled={!device.state.online}
                onClick={togglePower}
              >
                Turn {device.state.power ? 'off' : 'on'}
              </Button>
              <Button variant="secondary" icon={<Pencil className="size-3.5" />} onClick={() => setEditOpen(true)}>
                Edit
              </Button>
              <Link to={`/control?device=${device.id}`}>
                <Button variant="primary" icon={<SlidersHorizontal className="size-4" />}>
                  Open control
                </Button>
              </Link>
            </>
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <DeviceStatusBadge device={device} />
        <CompressorBadge device={device} />
        <Badge tone={device.inverter ? 'violet' : 'neutral'}>
          {device.inverter ? 'Inverter' : 'Fixed speed'}
        </Badge>
        <Badge tone="accent">{device.coolingCapacityKw} kW cooling</Badge>
        <span className="ml-auto text-[10.5px] text-muted">
          Updated {formatRelative(device.state.updatedAt)} · registered {formatDate(device.createdAt)}
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {/* Live climate */}
          <Card>
            <CardHeader
              title="Live climate"
              description={`${device.environment.areaM2} m² · ${INSULATION_META[device.environment.insulation].label} insulation · ${device.environment.occupancy} occupants`}
              icon={<Thermometer className="size-4" />}
              action={
                <Badge tone={device.state.compressorOn ? 'accent' : 'neutral'}>
                  {device.state.compressorOn ? 'Cooling' : 'Holding'}
                </Badge>
              }
            />
            <div className="grid gap-4 p-5 sm:grid-cols-[1.1fr_1fr]">
              <div className="rounded-xl border border-line bg-[radial-gradient(ellipse_100%_120%_at_0%_0%,var(--accent-soft),transparent_70%)] p-4">
                <p className="text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">
                  Room temperature
                </p>
                <div className="mt-2 flex items-end gap-2">
                  <span className="tnum text-[46px] leading-none font-semibold tracking-[-0.04em] text-fg">
                    {device.state.roomTempC.toFixed(1)}
                  </span>
                  <span className="pb-1 text-sm font-medium text-muted">{tempUnit}</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Badge tone="accent">Target {formatTemp(device.state.targetTempC, settings.temperatureUnit)}</Badge>
                  <span className={cn('text-[11px] font-medium', delta > 0.4 ? 'text-warning' : 'text-success')}>
                    {delta > 0 ? `+${delta.toFixed(1)}°` : `${delta.toFixed(1)}°`} off target
                  </span>
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-card-2">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#38BDF8,#818CF8)] transition-all duration-700"
                    style={{
                      width: `${Math.min(100, Math.max(3, device.state.compressorModulation))}%`,
                    }}
                  />
                </div>
                <p className="mt-1.5 text-[10px] text-muted">
                  Compressor modulation {device.state.compressorOn ? `${device.state.compressorModulation}%` : 'idle'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <Metric icon={<Zap className="size-3.5" />} label="Power draw" value={power.value} unit={power.unit} />
                <Metric icon={<Gauge className="size-3.5" />} label="Energy today" value={energy.value} unit={energy.unit} />
                <Metric icon={<Fan className="size-3.5" />} label="Fan speed" value={FAN_META[device.state.fanSpeed].label} />
                <Metric icon={<ModeIcon className="size-3.5" />} label="Mode" value={MODE_META[device.state.mode].label} />
                <Metric icon={<Droplets className="size-3.5" />} label="Humidity" value={`${device.state.humidityPct.toFixed(0)}`} unit="%" />
                <Metric icon={<Sun className="size-3.5" />} label="Outside" value={device.state.outsideTempC.toFixed(1)} unit={tempUnit} />
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Temperature history"
              description="Room, target and outdoor temperature for the selected window"
              icon={<Thermometer className="size-4" />}
              action={
                <SegmentedControl
                  value={range}
                  onChange={(value) => setRange(value as TimeRange)}
                  options={TIME_RANGES.map((r) => ({ value: r.value, label: r.label }))}
                  ariaLabel="History range"
                />
              }
            />
            <div className="p-4">
              {historyQuery.isLoading ? (
                <SkeletonChart height={240} />
              ) : historyQuery.error ? (
                <ErrorState
                  compact
                  message={errorMessage(historyQuery.error)}
                  onRetry={() => void historyQuery.refetch()}
                />
              ) : (
                <TemperatureChart data={series} height={250} showTarget showOutside />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Power draw"
              description="Compressor and fan consumption from the simulation engine"
              icon={<Zap className="size-4" />}
              action={
                <span className="tnum text-[11px] font-semibold text-fg-soft">
                  avg {formatNumber(stats.avgPower)} W · peak {formatNumber(stats.peakPower)} W
                </span>
              }
            />
            <div className="p-4">
              <PowerChart data={series} height={190} />
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Operating statistics" description={`Window: ${range}`} icon={<Gauge className="size-4" />} />
            <div className="divide-y divide-line">
              <Row label="Energy in window" value={`${formatNumber(stats.energy, 2)} kWh`} />
              <Row label="Estimated cost" value={formatMoney(stats.energy * settings.pricePerKwh, settings.currency)} />
              <Row label="Compressor runtime" value={`${stats.runtimePct.toFixed(0)}%`} />
              <Row label="Compressor cycles" value={String(stats.cycles)} />
              <Row label="Peak draw" value={`${formatNumber(stats.peakPower)} W`} />
              <Row label="Cooling capacity" value={`${device.coolingCapacityKw} kW`} />
              <Row label="Rated power" value={`${device.ratedPowerW} W`} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Room environment" icon={<Home className="size-4" />} />
            <div className="divide-y divide-line">
              <Row label="Room" value={device.environment.roomName} />
              <Row label="Floor area" value={`${device.environment.areaM2} m²`} />
              <Row label="Insulation" value={INSULATION_META[device.environment.insulation].label} />
              <Row label="Occupants" value={String(device.environment.occupancy)} />
              <Row label="Window exposure" value={`${Math.round(device.environment.windowExposure * 100)}%`} />
              <Row label="Internal heat gain" value={`${device.environment.heatGainW} W`} />
              <Row label="Outside temperature" value={`${device.environment.outsideTempC} ${tempUnit}`} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Device configuration" icon={<Cpu className="size-4" />} />
            <div className="divide-y divide-line">
              <Row label="Device key" value={<span className="font-mono text-[11px]">{device.key}</span>} />
              <Row label="Model" value={device.modelName} />
              <Row label="Brand" value={device.brand} />
              <Row label="Type" value={DEVICE_TYPE_LABEL[device.type]} />
              <Row label="Compressor" value={device.inverter ? 'Inverter' : 'Fixed speed'} />
              <Row label="Heating" value={device.supportsHeating ? 'Supported' : 'Not supported'} />
              <Row label="Location" value={device.location} />
            </div>
          </Card>

          <Card className="p-4">
            <p className="text-[11px] font-semibold text-fg">Danger zone</p>
            <p className="mt-1 text-[11px] leading-5 text-muted">
              Deleting a device removes its configuration, live telemetry and history from the workspace.
            </p>
            <Button
              variant="danger"
              size="sm"
              className="mt-3 w-full"
              icon={<Trash2 className="size-3.5" />}
              onClick={() => setDeleteOpen(true)}
            >
              Delete device
            </Button>
          </Card>
        </div>
      </div>

      <DeviceForm open={editOpen} device={device} onClose={() => setEditOpen(false)} />
      <ConfirmDialog
        open={deleteOpen}
        title={`Delete ${device.name}?`}
        description="The virtual unit, room configuration and telemetry history will be permanently removed."
        confirmLabel="Delete device"
        loading={deleting}
        onConfirm={confirmDelete}
        onClose={() => setDeleteOpen(false)}
      />
    </div>
  )
}

function Metric({
  icon,
  label,
  value,
  unit,
}: {
  icon: React.ReactNode
  label: string
  value: string
  unit?: string
}) {
  return (
    <div className="rounded-lg border border-line bg-card-2/60 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[9.5px] font-medium tracking-wide text-muted uppercase">
        <span className="text-accent">{icon}</span>
        {label}
      </p>
      <p className="tnum mt-1.5 text-[14px] leading-none font-semibold text-fg">
        {value}
        {unit ? <span className="ml-1 text-[10px] font-medium text-muted">{unit}</span> : null}
      </p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <span className="text-[11px] text-muted">{label}</span>
      <span className="tnum max-w-[60%] truncate text-right text-[11.5px] font-medium text-fg">{value}</span>
    </div>
  )
}
