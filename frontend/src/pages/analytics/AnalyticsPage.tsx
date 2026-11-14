import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  CalendarRange,
  CircleDollarSign,
  Download,
  Gauge,
  LineChart as LineChartIcon,
  Snowflake,
  Timer,
  TrendingDown,
  Zap,
} from 'lucide-react'
import type { EnergyBucket } from '@/types'
import { getAnalytics } from '@/api/analytics.api'
import { listDevices } from '@/api/devices.api'
import { useSettings } from '@/contexts/SettingsProvider'
import { useToast } from '@/contexts/ToastProvider'
import { CHART_COLORS } from '@/utils/constants'
import { cn, downloadCsv, formatMoney, formatNumber } from '@/utils/format'
import { PageHeader } from '@/components/common/PageHeader'
import { Card, CardHeader, SectionHeading } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { Select, SegmentedControl } from '@/components/common/Select'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { ChartEmpty, ChartLegend, ChartTooltip } from '@/components/charts/ChartKit'
import { AnalyticsComparison } from '@/components/analytics/AnalyticsComparison'
import { ErrorState, SkeletonCard, SkeletonChart } from '@/components/common/States'

type Days = 7 | 14 | 30 | 90
type Granularity = 'hour' | 'day' | 'week' | 'month'
type AnalyticsTab = 'energy' | 'comparison'

const TAB_OPTIONS: Array<{ value: AnalyticsTab; label: string }> = [
  { value: 'energy', label: 'Energy' },
  { value: 'comparison', label: 'Inverter vs fixed' },
]

const RANGE_OPTIONS: Array<{ value: Days; label: string }> = [
  { value: 7, label: '7D' },
  { value: 14, label: '14D' },
  { value: 30, label: '30D' },
  { value: 90, label: '90D' },
]

const TEMPERATURE_LEGEND = [
  { label: 'Room', color: CHART_COLORS.room },
  { label: 'Target', color: CHART_COLORS.target, dashed: true },
  { label: 'Outside', color: CHART_COLORS.outside },
]

const GRANULARITY_OPTIONS: Array<{ value: Granularity; label: string }> = [
  { value: 'hour', label: 'Hourly' },
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
]

export function AnalyticsPage() {
  const { settings } = useSettings()
  const { toast } = useToast()
  const [tab, setTab] = useState<AnalyticsTab>('energy')
  const [days, setDays] = useState<Days>(30)
  const [granularity, setGranularity] = useState<Granularity>('day')
  const [deviceId, setDeviceId] = useState<string>('all')

  const devicesQuery = useQuery({ queryKey: ['devices'], queryFn: listDevices })
  const analyticsQuery = useQuery({
    queryKey: ['analytics', deviceId, days, settings.pricePerKwh],
    queryFn: () => getAnalytics(deviceId === 'all' ? undefined : deviceId, days, settings.pricePerKwh),
  })

  const dataset = analyticsQuery.data
  const summary = dataset?.summary

  const buckets: EnergyBucket[] = useMemo(() => {
    if (!dataset) return []
    if (granularity === 'hour') return dataset.hourly
    if (granularity === 'week') return dataset.weekly
    if (granularity === 'month') return dataset.monthly
    return dataset.daily
  }, [dataset, granularity])

  const series = useMemo(
    () =>
      (dataset?.series ?? []).map((point) => ({
        ...point,
        deltaC: point.roomTempC - point.targetTempC,
      })),
    [dataset],
  )

  const stats = useMemo(() => {
    if (!buckets.length) {
      return { peak: null as EnergyBucket | null, avgBucketCost: 0, trend: null as number | null }
    }
    const peak = buckets.reduce((best, bucket) => (bucket.energyKwh > best.energyKwh ? bucket : best), buckets[0])
    const avgBucketCost = buckets.reduce((acc, b) => acc + b.cost, 0) / buckets.length
    const half = Math.max(1, Math.floor(buckets.length / 2))
    const older = buckets.slice(0, half).reduce((acc, b) => acc + b.energyKwh, 0) / half
    const newer = buckets.slice(-half).reduce((acc, b) => acc + b.energyKwh, 0) / half
    const trend = older > 0 ? ((newer - older) / older) * 100 : null
    return { peak, avgBucketCost, trend }
  }, [buckets])

  const deviceCount = Math.max(1, deviceId === 'all' ? (devicesQuery.data?.length ?? 1) : 1)

  const deviceOptions = [
    { value: 'all', label: 'All devices (fleet)' },
    ...(devicesQuery.data ?? []).map((device) => ({ value: device.id, label: device.name })),
  ]

  const exportCsv = () => {
    if (!buckets.length) return
    downloadCsv(
      `coolsense-analytics-${granularity}-${days}d.csv`,
      buckets.map((bucket) => ({
        period: bucket.label,
        energy_kwh: bucket.energyKwh.toFixed(3),
        cost: bucket.cost.toFixed(3),
        avg_power_w: Math.round(bucket.avgPowerW),
        tariff: settings.pricePerKwh,
        currency: settings.currency,
      })),
    )
    toast({ title: 'Export ready', description: `${buckets.length} rows downloaded as CSV.`, variant: 'success' })
  }

  const loading = analyticsQuery.isLoading && !dataset

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Insights"
        title={tab === 'energy' ? 'Energy analytics' : 'Inverter vs fixed-speed'}
        description={
          tab === 'energy'
            ? 'Where the electricity actually goes — by period, by device, and by how hard the compressor worked.'
            : 'Compare inverter and fixed-speed compressor behaviour under identical room conditions.'
        }
        actions={
          <>
            <SegmentedControl
              value={tab}
              onChange={(value) => setTab(value)}
              options={TAB_OPTIONS}
              ariaLabel="Analytics view"
            />
            {tab === 'energy' ? (
              <>
                <Select
                  value={deviceId}
                  options={deviceOptions}
                  onChange={(event) => setDeviceId(event.target.value)}
                  aria-label="Device filter"
                  className="h-9 min-w-[190px]"
                />
                <SegmentedControl
                  value={days}
                  onChange={(value) => setDays(value)}
                  options={RANGE_OPTIONS}
                  ariaLabel="Date range"
                />
                <Button
                  variant="secondary"
                  icon={<Download className="size-3.5" />}
                  onClick={exportCsv}
                  disabled={!buckets.length}
                >
                  Export
                </Button>
              </>
            ) : null}
          </>
        }
      />

      {tab === 'comparison' ? (
        <AnalyticsComparison />
      ) : (
        <div className="space-y-5">

      {analyticsQuery.error ? (
        <ErrorState
          message={analyticsQuery.error instanceof Error ? analyticsQuery.error.message : 'Analytics request failed'}
          onRetry={() => void analyticsQuery.refetch()}
        />
      ) : null}

      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {loading || !summary ? (
          Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} />)
        ) : (
          <>
            <MetricCard
              label="Total energy"
              value={formatNumber(summary.totalEnergyKwh, 1)}
              unit="kWh"
              icon={<Zap className="size-4" />}
              trend={stats.trend}
              trendLabel="vs earlier half"
              positiveIsGood={false}
              accent="accent"
              footer={`${formatNumber(summary.avgPowerW)} W average draw`}
            />
            <MetricCard
              label="Estimated cost"
              value={formatMoney(summary.estimatedCost, settings.currency)}
              icon={<CircleDollarSign className="size-4" />}
              accent="violet"
              footer={`${formatMoney(settings.pricePerKwh, settings.currency)} per kWh`}
            />
            <MetricCard
              label="Peak demand"
              value={formatNumber(summary.peakPowerW)}
              unit="W"
              icon={<Gauge className="size-4" />}
              accent="warning"
              footer={stats.peak ? `Highest in ${stats.peak.label}` : 'No peak recorded'}
            />
            <MetricCard
              label="Compressor runtime"
              value={formatNumber(summary.compressorRuntimeMin / 60, 1)}
              unit="h"
              icon={<Snowflake className="size-4" />}
              accent="success"
              footer={`${formatNumber(summary.compressorRuntimeMin / 60 / deviceCount, 0)} h per device`}
            />
          </>
        )}
      </div>

      {/* Energy + cost */}
      <div className="grid gap-3 lg:grid-cols-[1.55fr_1fr]">
        <Card>
          <CardHeader
            title="Energy by period"
            description={`${buckets.length} ${granularity} buckets · ${days}-day window`}
            icon={<LineChartIcon className="size-4" />}
            action={
              <span className="hidden sm:flex">
                <SegmentedControl
                  value={granularity}
                  onChange={(value) => setGranularity(value)}
                  options={GRANULARITY_OPTIONS}
                  ariaLabel="Granularity"
                />
              </span>
            }
          />
          <div className="p-4">
            <div className="mb-3 sm:hidden">
              <SegmentedControl
                value={granularity}
                onChange={(value) => setGranularity(value)}
                options={GRANULARITY_OPTIONS}
                ariaLabel="Granularity"
                className="w-full justify-between"
              />
            </div>
            {loading ? (
              <SkeletonChart height={260} />
            ) : buckets.length === 0 ? (
              <ChartEmpty message="No energy recorded in this window" height={260} />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={buckets} margin={{ top: 6, right: 6, left: -18, bottom: 0 }} barCategoryGap="24%">
                  <defs>
                    <linearGradient id="analyticsBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4ADE80" stopOpacity={0.95} />
                      <stop offset="100%" stopColor={CHART_COLORS.energy} stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="2 6" stroke="var(--border)" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    minTickGap={14}
                    dy={6}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    width={48}
                    tickFormatter={(value: number) => value.toFixed(1)}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--accent-soft)' }}
                    content={
                      <ChartTooltip
                        valueFormatter={(value) => value.toFixed(2)}
                        unitMap={{ energyKwh: 'kWh' }}
                        nameMap={{ energyKwh: 'Energy' }}
                      />
                    }
                  />
                  <Bar dataKey="energyKwh" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                    {buckets.map((bucket, index) => (
                      <Cell
                        key={`${bucket.label}-${index}`}
                        fill={stats.peak && bucket.label === stats.peak.label ? CHART_COLORS.energy : 'url(#analyticsBar)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Spend over time"
            description="Running cost at your tariff"
            icon={<CircleDollarSign className="size-4" />}
            action={
              <span className="hidden sm:flex">
                <ChartLegend items={[{ label: 'Cost', color: CHART_COLORS.cost }]} />
              </span>
            }
          />
          <div className="p-4">
            {loading ? (
              <SkeletonChart height={260} />
            ) : buckets.length === 0 ? (
              <ChartEmpty message="Nothing to bill yet" height={260} />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={buckets} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="costFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.cost} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={CHART_COLORS.cost} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="2 6" stroke="var(--border)" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    minTickGap={18}
                    dy={6}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    width={48}
                    tickFormatter={(value: number) => value.toFixed(1)}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip
                    content={
                      <ChartTooltip
                        valueFormatter={(value) => value.toFixed(2)}
                        unitMap={{ cost: settings.currency }}
                        nameMap={{ cost: 'Cost' }}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="cost"
                    stroke={CHART_COLORS.cost}
                    strokeWidth={2}
                    fill="url(#costFill)"
                    dot={false}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
            <ChartLegend items={[{ label: 'Cost', color: CHART_COLORS.cost }]} className="mt-3 sm:hidden" />
            <div className="mt-2 flex items-center justify-between rounded-lg border border-line bg-card-2 px-3 py-2">
              <span className="text-[10.5px] text-muted">Average per {granularity}</span>
              <span className="tnum text-[12px] font-semibold text-fg">
                {formatMoney(stats.avgBucketCost, settings.currency)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Temperature behaviour */}
      <Card>
        <CardHeader
          title="Temperature behaviour"
          description="Room vs set point across the stored series"
          icon={<Timer className="size-4" />}
          action={
            <span className="hidden sm:flex">
              <ChartLegend items={TEMPERATURE_LEGEND} />
            </span>
          }
        />
        <div className="p-4">
          {loading ? (
            <SkeletonChart height={230} />
          ) : series.length === 0 ? (
            <ChartEmpty message="No temperature samples in this window" height={230} />
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <ComposedChart data={series} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="2 6" stroke="var(--border)" />
                <XAxis
                  dataKey="time"
                  tickFormatter={(value: string) =>
                    new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit' })
                  }
                  axisLine={false}
                  tickLine={false}
                  minTickGap={46}
                  dy={6}
                  tick={{ fontSize: 10 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  tickFormatter={(value: number) => `${value.toFixed(0)}°`}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      titleFormatter={(value) => new Date(value).toLocaleString()}
                      valueFormatter={(value) => value.toFixed(1)}
                      unitMap={{ roomTempC: '°C', targetTempC: '°C', outsideTempC: '°C' }}
                      nameMap={{ roomTempC: 'Room', targetTempC: 'Target', outsideTempC: 'Outside' }}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="roomTempC"
                  stroke={CHART_COLORS.room}
                  strokeWidth={2}
                  fill={CHART_COLORS.room}
                  fillOpacity={0.1}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="targetTempC"
                  stroke={CHART_COLORS.target}
                  strokeWidth={1.4}
                  strokeDasharray="4 4"
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="outsideTempC"
                  stroke={CHART_COLORS.outside}
                  strokeWidth={1.2}
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
          <ChartLegend items={TEMPERATURE_LEGEND} className="mt-3 sm:hidden" />
        </div>
      </Card>

      {/* Breakdown table */}
      <div>
        <SectionHeading
          title="Period breakdown"
          description="Sortable view of energy, cost and average load per bucket"
          action={
            <span className="flex items-center gap-1.5 text-[10.5px] text-muted">
              <CalendarRange className="size-3.5" />
              {days} days · {granularity}
            </span>
          }
        />
        <Card className="mt-3">
          <div className="max-h-[380px] overflow-auto">
            <table className="w-full text-left text-[11.5px]">
              <thead className="sticky top-0 z-10 bg-card-2 text-[9.5px] font-semibold tracking-[0.1em] text-muted uppercase">
                <tr>
                  <th className="px-4 py-2.5">Period</th>
                  <th className="px-4 py-2.5 text-right">Energy</th>
                  <th className="hidden px-4 py-2.5 text-right sm:table-cell">Avg load</th>
                  <th className="px-4 py-2.5 text-right">Cost</th>
                  <th className="px-4 py-2.5">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted">
                      Loading periods…
                    </td>
                  </tr>
                ) : buckets.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted">
                      No data for this window.
                    </td>
                  </tr>
                ) : (
                  [...buckets].reverse().map((bucket, index) => {
                    const max = Math.max(...buckets.map((b) => b.energyKwh), 0.0001)
                    const share = (bucket.energyKwh / max) * 100
                    return (
                      <tr key={`${bucket.label}-${index}`} className="transition-colors hover:bg-card-2/60">
                        <td className="px-4 py-2 font-medium text-fg">{bucket.label}</td>
                        <td className="tnum px-4 py-2 text-right whitespace-nowrap text-fg-soft">
                          {bucket.energyKwh.toFixed(2)} kWh
                        </td>
                        <td className="tnum hidden px-4 py-2 text-right whitespace-nowrap text-muted sm:table-cell">
                          {formatNumber(bucket.avgPowerW)} W
                        </td>
                        <td className="tnum px-4 py-2 text-right text-fg">{formatMoney(bucket.cost, settings.currency)}</td>
                        <td className="px-4 py-2">
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-card-2">
                            <div
                              className={cn('h-full rounded-full', share > 85 ? 'bg-warning' : 'bg-success')}
                              style={{ width: `${Math.max(3, share)}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-[10.5px] text-muted">
            <span className="flex items-center gap-1.5">
              <TrendingDown className="size-3.5" />
              Peak bucket: {stats.peak ? stats.peak.label : '—'} ·{' '}
              {stats.peak ? `${stats.peak.energyKwh.toFixed(2)} kWh` : 'no data'}
            </span>
            <span>All figures are simulated telemetry · tariff {formatMoney(settings.pricePerKwh, settings.currency)}/kWh</span>
          </div>
        </Card>
        </div>
        </div>
      )}
    </div>
  )
}
