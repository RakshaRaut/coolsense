import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AirVent,
  ArrowUpRight,
  CircleDollarSign,
  CloudSun,
  Cpu,
  Droplets,
  FlaskConical,
  Gauge,
  Plus,
  RefreshCw,
  Snowflake,
  Thermometer,
  TrendingUp,
  Zap,
} from 'lucide-react'
import type { AcDevice } from '@/types'
import { getFleetHistory } from '@/api/dashboard.api'
import { getDeviceTemperatureHistory } from '@/api/devices.api'
import { getAnalytics } from '@/api/analytics.api'
import { useLiveData } from '@/contexts/LiveDataProvider'
import { useAuth } from '@/contexts/AuthProvider'
import { useSettings } from '@/contexts/SettingsProvider'
import { IS_MOCK, TIME_RANGES } from '@/utils/constants'
import {
  cn,
  formatLongDate,
  formatMoney,
  formatNumber,
  formatRelative,
  formatTemp,
  tempUnitLabel,
} from '@/utils/format'
import { PageHeader } from '@/components/common/PageHeader'
import { Card, CardHeader, SectionHeading } from '@/components/common/Card'
import { Button, buttonStyles } from '@/components/common/Button'
import { Badge, StatusDot } from '@/components/common/Badge'
import { DataSourceBadge, EmptyState, ErrorState, SkeletonCard } from '@/components/common/States'
import { Tooltip } from '@/components/common/PageHeader'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { TemperatureChart, type TimeRange } from '@/components/dashboard/TemperatureChart'
import { PowerChart } from '@/components/dashboard/PowerChart'
import { EnergyChart } from '@/components/dashboard/EnergyChart'
import { DeviceOverviewCard } from '@/components/dashboard/DeviceOverviewCard'
import { DeviceForm } from '@/components/devices/DeviceForm'
import { useSimulationSocket } from '@/hooks/useSimulationSocket'

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 5) return 'Good night'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function DashboardPage() {
  const { devices, isLoading, error, refetch, connection } = useLiveData()
  const { user } = useAuth()
  const { settings } = useSettings()
  const navigate = useNavigate()

  const [range, setRange] = useState<TimeRange>('24h')
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>()
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<AcDevice | null>(null)

  const rangeSeconds = TIME_RANGES.find((r) => r.value === range)?.seconds ?? 86_400
  const bucketCount = range === '7d' ? 84 : range === '1h' ? 60 : 96
  const selectedDevice = devices.find((device) => device.id === selectedDeviceId) ?? devices[0]
  const activeDeviceId = selectedDevice?.id
  const live = useSimulationSocket(activeDeviceId)

  const fleetQuery = useQuery({
    queryKey: ['fleet-history', range],
    queryFn: () => getFleetHistory(rangeSeconds, bucketCount),
    refetchInterval: 20_000,
  })

  const temperatureQuery = useQuery({
    queryKey: ['device-temperature-history', activeDeviceId, range],
    queryFn: () =>
      getDeviceTemperatureHistory(activeDeviceId ?? '', rangeSeconds, 1000),
    enabled: Boolean(activeDeviceId),
    refetchInterval: 20_000,
  })

  const analyticsQuery = useQuery({
    queryKey: ['analytics', 'fleet', 7, settings.pricePerKwh],
    queryFn: () => getAnalytics(undefined, 7, settings.pricePerKwh),
    refetchInterval: 45_000,
  })

  const summary = useMemo(() => {
    const online = devices.filter((d) => d.state.online)
    const active = online.filter((d) => d.state.power)
    const avgRoom = online.length
      ? online.reduce((acc, d) => acc + d.state.roomTempC, 0) / online.length
      : 0
    const avgTarget = online.length
      ? online.reduce((acc, d) => acc + d.state.targetTempC, 0) / online.length
      : 0
    const avgOutside = online.length
      ? online.reduce((acc, d) => acc + d.state.outsideTempC, 0) / online.length
      : 0
    const avgHumidity = online.length
      ? online.reduce((acc, d) => acc + d.state.humidityPct, 0) / online.length
      : 0
    const totalPower = online.reduce((acc, d) => acc + d.state.powerW, 0)
    const totalEnergy = online.reduce((acc, d) => acc + d.state.energyKwh, 0)
    return {
      total: devices.length,
      online: online.length,
      active: active.length,
      avgRoom,
      avgTarget,
      avgOutside,
      avgHumidity,
      totalPower,
      totalEnergy,
      cost: totalEnergy * settings.pricePerKwh,
      cooling: active.filter((d) => d.state.compressorOn).length,
    }
  }, [devices, settings.pricePerKwh])

  const selectedTemperature = live.telemetry?.roomTempC ?? selectedDevice?.state.roomTempC ?? summary.avgRoom
  const selectedTarget = live.telemetry?.targetTempC ?? selectedDevice?.state.targetTempC ?? summary.avgTarget
  const selectedOutside = live.telemetry?.outsideTempC ?? selectedDevice?.state.outsideTempC ?? summary.avgOutside
  const selectedHumidity = live.telemetry?.humidityPct ?? selectedDevice?.state.humidityPct ?? summary.avgHumidity

  const temperatureSeries = useMemo(() => {
    const cutoff = Date.now() - rangeSeconds * 1000
    const samples = (temperatureQuery.data ?? []).filter(
      (sample) => new Date(sample.time).getTime() >= cutoff,
    )
    const telemetry = live.telemetry
    if (
      telemetry &&
      telemetry.deviceId === activeDeviceId &&
      new Date(telemetry.timestamp).getTime() >= cutoff
    ) {
      samples.push({
        time: telemetry.timestamp,
        roomTempC: telemetry.roomTempC,
        targetTempC: telemetry.targetTempC,
        outsideTempC: telemetry.outsideTempC,
      })
    }
    return samples
      .sort((a, b) => a.time.localeCompare(b.time))
      .filter((sample, index, rows) => index === 0 || sample.time !== rows[index - 1].time)
  }, [temperatureQuery.data, live.telemetry, activeDeviceId, rangeSeconds])

  const trend = useMemo(() => {
    const series = fleetQuery.data ?? []
    if (series.length < 4) return { power: null as number | null, energy: null as number | null }
    const cut = Math.floor(series.length * 0.75)
    const recent = series.slice(cut)
    const earlier = series.slice(Math.floor(series.length * 0.5), cut)
    const mean = (rows: typeof series, key: 'powerW' | 'energyKwh') =>
      rows.reduce((acc, row) => acc + row[key], 0) / Math.max(1, rows.length)
    const recentPower = mean(recent, 'powerW')
    const earlierPower = mean(earlier, 'powerW')
    const daily = analyticsQuery.data?.daily ?? []
    const energyTrend =
      daily.length >= 2 && daily[daily.length - 2].energyKwh > 0
        ? ((daily[daily.length - 1].energyKwh - daily[daily.length - 2].energyKwh) /
            daily[daily.length - 2].energyKwh) *
          100
        : null
    return {
      power: earlierPower > 0 ? ((recentPower - earlierPower) / earlierPower) * 100 : null,
      energy: energyTrend,
    }
  }, [fleetQuery.data, analyticsQuery.data])

  const firstName = user?.name?.split(' ')[0] ?? 'Operator'
  const tempUnit = tempUnitLabel(settings.temperatureUnit)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-9 w-64 animate-pulse rounded-lg bg-card-2" />
        <SkeletonCard className="h-[300px]" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-2">
            <StatusDot tone={connection === 'connected' ? 'success' : 'warning'} pulse />
            {formatLongDate()}
          </span>
        }
        title={`${greeting()}, ${firstName}`}
        description="Your virtual AC fleet is live. Room physics, compressor behaviour and energy are simulated in the browser."
        actions={
          <>
            <Button
              variant="secondary"
              icon={<RefreshCw className={cn('size-3.5', fleetQuery.isFetching && 'animate-spin')} />}
              onClick={refetch}
            >
              Refresh
            </Button>
            <Button
              variant="secondary"
              icon={<FlaskConical className="size-3.5" />}
              onClick={() => navigate('/simulation')}
            >
              Start simulation
            </Button>
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setAddOpen(true)}>
              Add AC device
            </Button>
          </>
        }
      />

      {error ? <ErrorState message={error} onRetry={refetch} /> : null}

      {devices.length === 0 ? (
        <EmptyState
          icon={<AirVent className="size-6" />}
          title="No virtual AC devices yet"
          description="CoolSense simulates real cooling behaviour — register your first virtual unit to see live temperatures, compressor cycling and energy analytics."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setAddOpen(true)}>
                Add AC device
              </Button>
              <Button variant="outline" onClick={() => navigate('/simulation')}>
                Open simulation lab
              </Button>
            </div>
          }
        />
      ) : (
        <>
          {/* Fleet climate hero */}
          <section className="surface relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_120%_at_0%_0%,rgb(56_189_248/0.10),transparent_60%),radial-gradient(ellipse_50%_100%_at_100%_100%,rgb(129_140_248/0.10),transparent_60%)]" />
            <div className="relative grid lg:grid-cols-[286px_1fr]">
              <div className="flex flex-col justify-between gap-6 border-b border-line p-5 lg:border-r lg:border-b-0">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold tracking-[0.14em] text-muted uppercase">
                      {selectedDevice?.name ?? 'Fleet average'} temperature
                    </p>
                    <DataSourceBadge source={IS_MOCK ? 'mock' : 'backend'} />
                  </div>
                  <div className="mt-3 flex items-end gap-2">
                    <span className="tnum text-[44px] leading-none font-semibold tracking-[-0.03em] text-fg">
                      {selectedTemperature.toFixed(1)}
                    </span>
                    <span className="pb-1 text-sm font-medium text-muted">{tempUnit}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge tone="accent">
                      Target {formatTemp(selectedTarget, settings.temperatureUnit)}
                    </Badge>
                    <span
                      className={cn(
                        'text-[11px] font-medium',
                        selectedTemperature > selectedTarget + 0.5 ? 'text-warning' : 'text-success',
                      )}
                    >
                      {selectedTemperature > selectedTarget
                        ? `${(selectedTemperature - selectedTarget).toFixed(1)}° above target`
                        : `${(selectedTarget - selectedTemperature).toFixed(1)}° below target`}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-2.5 text-[10.5px] text-muted">
                    <span className="flex items-center gap-1">
                      <CloudSun className="size-3" />
                      Outside
                      <span className="tnum font-semibold text-fg-soft">
                        {formatTemp(selectedOutside, settings.temperatureUnit)}
                      </span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Droplets className="size-3" />
                      Humidity
                      <span className="tnum font-semibold text-fg-soft">
                        {Math.round(selectedHumidity)}%
                      </span>
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 text-muted">
                      <Snowflake className="size-3.5 text-accent" /> Cooling now
                    </span>
                    <span className="tnum font-semibold text-fg">
                      {summary.cooling}/{summary.active || 0} units
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-card-2">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#38BDF8,#818CF8)] transition-all duration-700"
                      style={{
                        width: `${summary.active ? Math.max(6, (summary.cooling / Math.max(1, summary.active)) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between pt-1 text-[10.5px] text-muted">
                    <span>{summary.active} units powered</span>
                    <span className="tnum">
                      {formatNumber(summary.totalPower)} W draw
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-[11px] text-muted">
                    Device
                    <select
                      aria-label="Select device for temperature chart"
                      className="rounded-md border border-line bg-card px-2 py-1 text-[11px] text-fg"
                      value={activeDeviceId ?? ''}
                      onChange={(event) => setSelectedDeviceId(event.target.value)}
                    >
                      {devices.map((device) => (
                        <option key={device.id} value={device.id}>
                          {device.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span className="text-[10.5px] text-muted">
                    {live.simulation?.simulationId
                      ? live.simulation.status
                      : selectedDevice?.simulated
                        ? 'running'
                        : 'idle'}
                    {live.commandStatus
                      ? ` · last command ${live.commandStatus.success ? 'confirmed' : 'failed'}`
                      : ''}
                  </span>
                </div>
                {temperatureQuery.error ? (
                  <ErrorState
                    message={temperatureQuery.error.message}
                    onRetry={() => void temperatureQuery.refetch()}
                  />
                ) : (
                  <TemperatureChart
                    data={temperatureSeries}
                    range={range}
                    onRangeChange={setRange}
                    height={232}
                    showTarget
                  />
                )}
              </div>
            </div>
          </section>

          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <MetricCard
              label="AC devices"
              value={String(summary.total)}
              unit="units"
              icon={<AirVent className="size-3.5" />}
              footer={`${summary.online} online · ${summary.total - summary.online} offline`}
              accent="accent"
            />
            <MetricCard
              label="Active units"
              value={String(summary.active)}
              unit="cooling"
              icon={<Power3Icon />}
              trend={summary.total ? (summary.active / summary.total) * 100 : 0}
              trendLabel={`utilisation`}
              footer={`${Math.round(summary.total ? (summary.active / summary.total) * 100 : 0)}% of fleet running`}
              accent="success"
            />
            <MetricCard
              label="Avg room temp"
              value={summary.avgRoom.toFixed(1)}
              unit={tempUnit}
              icon={<Thermometer className="size-3.5" />}
              trendLabel={`${Math.abs(summary.avgRoom - summary.avgTarget).toFixed(1)}° from target`}
              accent="violet"
            />
            <MetricCard
              label="Power draw"
              value={summary.totalPower >= 1000 ? (summary.totalPower / 1000).toFixed(2) : String(summary.totalPower)}
              unit={summary.totalPower >= 1000 ? 'kW' : 'W'}
              icon={<Zap className="size-3.5" />}
              trend={trend.power}
              trendLabel="vs previous period"
              positiveIsGood={false}
              accent="warning"
            />
            <MetricCard
              label="Energy today"
              value={summary.totalEnergy.toFixed(2)}
              unit="kWh"
              icon={<Gauge className="size-3.5" />}
              trend={trend.energy}
              trendLabel="vs yesterday"
              positiveIsGood={false}
              accent="accent"
            />
            <MetricCard
              label="Est. cost today"
              value={formatMoney(summary.cost, settings.currency)}
              icon={<CircleDollarSign className="size-3.5" />}
              footer={`@ ${formatMoney(settings.pricePerKwh, settings.currency)}/kWh`}
              accent="success"
            />
          </div>

          {/* Device overview */}
          <div>
            <SectionHeading
              title="AC overview"
              description="Live state of every virtual unit in the workspace"
              action={
                <Link to="/devices" className={buttonStyles('ghost', 'sm')}>
                  View all <ArrowUpRight className="size-3.5" />
                </Link>
              }
              className="mb-3"
            />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {devices.slice(0, 6).map((device) => (
                <DeviceOverviewCard key={device.id} device={device} onEdit={setEditing} />
              ))}
            </div>
          </div>

          {/* Power + energy */}
          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader
                title="Fleet power consumption"
                description="Aggregated compressor and fan draw across online units"
                icon={<Zap className="size-4" />}
                action={
                  <Tooltip label="Updates every 20 seconds">
                    <span className="tnum rounded-md border border-line bg-card-2 px-1.5 py-0.5 text-[10.5px] font-semibold text-fg-soft">
                      {formatNumber(summary.totalPower)} W
                    </span>
                  </Tooltip>
                }
              />
              <div className="p-4">
                <PowerChart data={fleetQuery.data ?? []} height={210} />
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Energy by day"
                description={`Last 7 days · ${settings.currency}`}
                icon={<Gauge className="size-4" />}
                action={<TrendingUp className="size-3.5 text-muted" />}
              />
              <div className="p-4">
                <EnergyChart data={analyticsQuery.data?.daily.slice(-7) ?? []} height={210} />
                <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[11px]">
                  <span className="text-muted">7-day total</span>
                  <span className="tnum font-semibold text-fg">
                    {formatNumber(
                      (analyticsQuery.data?.daily ?? []).slice(-7).reduce((a, b) => a + b.energyKwh, 0),
                      1,
                    )}{' '}
                    kWh
                  </span>
                </div>
              </div>
            </Card>
          </div>

          <p className="flex items-center justify-center gap-1.5 pb-2 text-[10.5px] text-muted">
            <Cpu className="size-3" />
            {IS_MOCK
              ? 'Simulation running in mock mode · data generated in your browser · last update'
              : 'Connected to backend telemetry · last update'}{' '}
            {selectedDevice ? formatRelative(selectedDevice.state.updatedAt) : '—'}
          </p>
        </>
      )}

      <DeviceForm
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={() => refetch()}
      />
      <DeviceForm
        open={Boolean(editing)}
        device={editing}
        onClose={() => setEditing(null)}
        onSaved={() => refetch()}
      />
    </div>
  )
}

function Power3Icon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
      <path d="M12 3v9" strokeLinecap="round" />
      <path d="M6.6 6.6a8 8 0 1 0 10.8 0" strokeLinecap="round" />
    </svg>
  )
}
