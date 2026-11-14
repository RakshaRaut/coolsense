import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowUpRight,
  GitCompareArrows,
  Info,
  Loader2,
  Play,
  Snowflake,
  Thermometer,
  Timer,
  TrendingDown,
  Waves,
  Zap,
} from 'lucide-react'
import type { AppSettings, ComparisonResult } from '@/types'
import {
  runAcComparison,
  type ComparisonConfig,
  type ComparisonResponse,
} from '@/api/analytics.api'
import { errorMessage } from '@/api/axios'
import { useSettings } from '@/contexts/SettingsProvider'
import { useToast } from '@/contexts/ToastProvider'
import { INSULATION_LIST } from '@/utils/constants'
import { cn, formatMoney, formatNumber } from '@/utils/format'
import { Card, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { Badge } from '@/components/common/Badge'
import { Select } from '@/components/common/Select'
import { Slider } from '@/components/common/Slider'
import { ChartTooltip, ChartLegend } from '@/components/charts/ChartKit'
import { ErrorState } from '@/components/common/States'

const DEFAULTS: ComparisonConfig = {
  outsideTempC: 35,
  initialRoomTempC: 30,
  targetTempC: 24,
  areaM2: 22,
  insulation: 'average',
  capacityKw: 3.5,
  durationMin: 240,
  occupancy: 2,
  windowExposure: 0.3,
  heatGainW: 180,
  pricePerKwh: 0.24,
}

export function AnalyticsComparison() {
  const { settings } = useSettings()
  const { toast } = useToast()
  const [config, setConfig] = useState<ComparisonConfig>({ ...DEFAULTS, pricePerKwh: settings.pricePerKwh })
  const [result, setResult] = useState<ComparisonResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(
    async (next: ComparisonConfig) => {
      setLoading(true)
      setError(null)
      try {
        const data = await runAcComparison(next)
        setResult(data)
      } catch (err) {
        setError(errorMessage(err))
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    void run({ ...DEFAULTS, pricePerKwh: settings.pricePerKwh })
    // Run once on mount with the user's tariff.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const patch = (next: Partial<ComparisonConfig>) => setConfig((prev) => ({ ...prev, ...next }))

  const chartData = useMemo(() => {
    if (!result) return []
    const fixedByT = new Map(result.fixed.series.map((s) => [s.t, s]))
    return result.inverter.series.map((sample) => {
      const fixed = fixedByT.get(sample.t)
      return {
        t: sample.t,
        inverterTemp: sample.roomTempC,
        fixedTemp: fixed?.roomTempC ?? null,
        target: sample.targetTempC,
        inverterPower: sample.powerW,
        fixedPower: fixed?.powerW ?? null,
        inverterEnergy: sample.energyKwh,
        fixedEnergy: fixed?.energyKwh ?? null,
      }
    })
  }, [result])

  const verdict = useMemo(() => {
    if (!result) return null
    const { inverter, fixed } = result
    const faster =
      inverter.timeToTargetMin == null && fixed.timeToTargetMin == null
        ? null
        : inverter.timeToTargetMin == null
          ? fixed
          : fixed.timeToTargetMin == null
            ? inverter
            : inverter.timeToTargetMin < fixed.timeToTargetMin
              ? inverter
              : fixed
    const efficient = inverter.totalEnergyKwh < fixed.totalEnergyKwh ? inverter : fixed
    const stable = inverter.tempStabilityC < fixed.tempStabilityC ? inverter : fixed
    const savings = Math.abs(inverter.totalEnergyKwh - fixed.totalEnergyKwh)
    return { faster, efficient, stable, savings }
  }, [result])

  const applyConfig = () => {
    const next = { ...config, pricePerKwh: settings.pricePerKwh }
    void run(next)
    toast({ title: 'Comparison running', description: 'Recomputing both scenarios with your inputs.', variant: 'info' })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-[11.5px] leading-5 text-muted">
          Both units start in the same room, at the same temperature, chasing the same set point. Only the
          compressor strategy differs.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => setConfig({ ...DEFAULTS, pricePerKwh: settings.pricePerKwh })}>
            Defaults
          </Button>
          <Button variant="primary" icon={<Play className="size-4" />} loading={loading} onClick={applyConfig}>
            Run comparison
          </Button>
        </div>
      </div>

      {error ? <ErrorState message={error} onRetry={() => void run(config)} /> : null}

      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        {/* Config */}
        <Card className="h-fit">
          <CardHeader
            title="Test conditions"
            description="Identical for both units"
            icon={<GitCompareArrows className="size-4" />}
          />
          <div className="space-y-4 p-4">
            <Slider
              label="Outside temperature"
              value={config.outsideTempC}
              min={20}
              max={46}
              step={1}
              unit="°C"
              onChange={(value) => patch({ outsideTempC: value })}
            />
            <Slider
              label="Initial room temperature"
              value={config.initialRoomTempC}
              min={24}
              max={40}
              step={0.5}
              unit="°C"
              onChange={(value) => patch({ initialRoomTempC: value })}
            />
            <Slider
              label="Target temperature"
              value={config.targetTempC}
              min={16}
              max={28}
              step={0.5}
              unit="°C"
              onChange={(value) => patch({ targetTempC: value })}
            />
            <Slider
              label="Room area"
              value={config.areaM2}
              min={10}
              max={70}
              step={1}
              unit="m²"
              onChange={(value) => patch({ areaM2: value })}
            />
            <Slider
              label="Cooling capacity"
              value={config.capacityKw}
              min={2.5}
              max={7}
              step={0.5}
              unit="kW"
              hint="Applied to both units"
              onChange={(value) => patch({ capacityKw: value })}
            />
            <Slider
              label="Test duration"
              value={config.durationMin}
              min={60}
              max={480}
              step={30}
              unit="min"
              onChange={(value) => patch({ durationMin: value })}
            />
            <Slider
              label="Occupants"
              value={config.occupancy}
              min={0}
              max={6}
              step={1}
              unit="people"
              onChange={(value) => patch({ occupancy: value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1.5 text-[11.5px] font-medium text-fg-soft">Insulation</p>
                <Select
                  value={config.insulation}
                  onChange={(event) => patch({ insulation: event.target.value as ComparisonConfig['insulation'] })}
                  options={INSULATION_LIST.map((i) => ({ value: i.value, label: i.label }))}
                  className="h-9"
                  aria-label="Insulation"
                />
              </div>
              <div className="rounded-lg border border-line bg-card-2 px-2.5 py-1.5">
                <p className="text-[9px] font-medium tracking-wide text-muted uppercase">Tariff</p>
                <p className="tnum mt-0.5 text-[12px] font-semibold text-fg">
                  {formatMoney(settings.pricePerKwh, settings.currency)}/kWh
                </p>
              </div>
            </div>
            <p className="flex items-start gap-1.5 rounded-lg border border-line bg-card-2/60 px-2.5 py-2 text-[10px] leading-4 text-muted">
              <Info className="mt-0.5 size-3 shrink-0" />
              Inverter units modulate compressor speed; fixed-speed units cycle on and off at full
              capacity.
            </p>
          </div>
        </Card>

        {/* Results */}
        <div className="space-y-4">
          {loading && !result ? (
            <div className="flex h-[320px] items-center justify-center rounded-2xl border border-line bg-card">
              <div className="flex flex-col items-center gap-3 text-muted">
                <Loader2 className="size-6 animate-spin text-accent" />
                <p className="text-[12px]">Running 8 hours of physics for two units…</p>
              </div>
            </div>
          ) : result ? (
            <>
              {/* Verdict */}
              <Card className="relative overflow-hidden">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_120%_at_0%_0%,var(--accent-soft),transparent_60%),radial-gradient(ellipse_50%_120%_at_100%_100%,var(--violet-soft),transparent_60%)]" />
                <div className="relative grid gap-3 p-4 sm:grid-cols-3">
                  <VerdictTile
                    label="Reaches target first"
                    value={verdict?.faster ? verdict.faster.label : 'Neither'}
                    detail={
                      verdict?.faster?.timeToTargetMin != null
                        ? `${verdict.faster.timeToTargetMin.toFixed(0)} min to set point`
                        : 'Set point not reached'
                    }
                    tone="accent"
                  />
                  <VerdictTile
                    label="Lowest energy use"
                    value={verdict?.efficient.label ?? '—'}
                    detail={`${formatNumber(verdict?.savings ?? 0, 2)} kWh saved over the run`}
                    tone="success"
                  />
                  <VerdictTile
                    label="Steadiest room"
                    value={verdict?.stable.label ?? '—'}
                    detail={`${formatSwing(verdict?.stable.tempStabilityC ?? 0)} in the final quarter`}
                    tone="violet"
                  />
                </div>
              </Card>

              {/* Metric comparison */}
              <div className="grid gap-3 sm:grid-cols-2">
                <UnitCard title="Inverter AC" result={result.inverter} currency={settings.currency} highlight />
                <UnitCard title="Fixed-speed AC" result={result.fixed} currency={settings.currency} />
              </div>

              <Card>
                <CardHeader
                  title="Room temperature"
                  description={`${config.initialRoomTempC} °C → ${config.targetTempC} °C · ${config.durationMin} simulated minutes`}
                  icon={<Thermometer className="size-4" />}
                  action={
                    <span className="hidden sm:flex">
                      <ChartLegend items={TEMPERATURE_LEGEND} />
                    </span>
                  }
                />
                <div className="p-4">
                  <ResponsiveContainer width="100%" height={250}>
                    <ComposedChart data={chartData} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="cmpInverter" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.22} />
                          <stop offset="100%" stopColor="#38BDF8" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} strokeDasharray="2 6" stroke="var(--border)" />
                      <XAxis
                        dataKey="t"
                        tickFormatter={(value: number) => `${value}m`}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={40}
                        dy={6}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        width={48}
                        domain={['dataMin - 0.5', 'dataMax + 0.5']}
                        tickFormatter={(value: number) => `${value.toFixed(0)}°`}
                      />
                      <Tooltip
                        cursor={{ stroke: 'var(--border)' }}
                        content={
                          <ChartTooltip
                            titleFormatter={(value) => `${value} simulated minutes`}
                            valueFormatter={(value) => value.toFixed(2)}
                            unitMap={{ inverterTemp: '°C', fixedTemp: '°C', target: '°C' }}
                            nameMap={{ inverterTemp: 'Inverter', fixedTemp: 'Fixed speed', target: 'Target' }}
                          />
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="inverterTemp"
                        stroke="#38BDF8"
                        strokeWidth={2.2}
                        fill="url(#cmpInverter)"
                        dot={false}
                        isAnimationActive={false}
                      />
                      <Line type="monotone" dataKey="fixedTemp" stroke="#F59E0B" strokeWidth={2.2} dot={false} isAnimationActive={false} />
                      <Line
                        type="monotone"
                        dataKey="target"
                        stroke="#818CF8"
                        strokeWidth={1.4}
                        strokeDasharray="4 4"
                        dot={false}
                        isAnimationActive={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <ChartLegend items={TEMPERATURE_LEGEND} className="mt-3 sm:hidden" />
                </div>
              </Card>

              <div className="grid gap-3 lg:grid-cols-2">
                <Card>
                  <CardHeader title="Power draw" description="Compressor cycling vs modulation" icon={<Zap className="size-4" />} />
                  <div className="p-4">
                    <ResponsiveContainer width="100%" height={210}>
                      <ComposedChart data={chartData} margin={{ top: 6, right: 6, left: -8, bottom: 0 }}>
                        <CartesianGrid vertical={false} strokeDasharray="2 6" stroke="var(--border)" />
                        <XAxis
                          dataKey="t"
                          tickFormatter={(value: number) => `${value}m`}
                          axisLine={false}
                          tickLine={false}
                          minTickGap={40}
                          dy={6}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          width={54}
                          tickFormatter={(value: number) => `${(value / 1000).toFixed(1)}k`}
                        />
                        <Tooltip
                          content={
                            <ChartTooltip
                              titleFormatter={(value) => `${value} simulated minutes`}
                              valueFormatter={(value) => value.toFixed(0)}
                              unitMap={{ inverterPower: 'W', fixedPower: 'W' }}
                              nameMap={{ inverterPower: 'Inverter', fixedPower: 'Fixed speed' }}
                            />
                          }
                        />
                        <Line
                          type="monotone"
                          dataKey="inverterPower"
                          stroke="#38BDF8"
                          strokeWidth={1.6}
                          dot={false}
                          isAnimationActive={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="fixedPower"
                          stroke="#F59E0B"
                          strokeWidth={1.6}
                          dot={false}
                          isAnimationActive={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card>
                  <CardHeader title="Cumulative energy" description="kWh consumed over the test" icon={<TrendingDown className="size-4" />} />
                  <div className="p-4">
                    <ResponsiveContainer width="100%" height={210}>
                      <ComposedChart data={chartData} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                        <defs>
                          <linearGradient id="cmpEnergy" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22C55E" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} strokeDasharray="2 6" stroke="var(--border)" />
                        <XAxis
                          dataKey="t"
                          tickFormatter={(value: number) => `${value}m`}
                          axisLine={false}
                          tickLine={false}
                          minTickGap={40}
                          dy={6}
                        />
                        <YAxis axisLine={false} tickLine={false} width={48} tickFormatter={(value: number) => value.toFixed(1)} />
                        <Tooltip
                          content={
                            <ChartTooltip
                              titleFormatter={(value) => `${value} simulated minutes`}
                              valueFormatter={(value) => value.toFixed(3)}
                              unitMap={{ inverterEnergy: 'kWh', fixedEnergy: 'kWh' }}
                              nameMap={{ inverterEnergy: 'Inverter', fixedEnergy: 'Fixed speed' }}
                            />
                          }
                        />
                        <Area
                          type="monotone"
                          dataKey="inverterEnergy"
                          stroke="#22C55E"
                          strokeWidth={2}
                          fill="url(#cmpEnergy)"
                          dot={false}
                          isAnimationActive={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="fixedEnergy"
                          stroke="#F59E0B"
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              <div className="flex items-start gap-2 rounded-xl border border-warning/25 bg-warning-soft px-4 py-3">
                <Info className="mt-0.5 size-3.5 shrink-0 text-warning" />
                <p className="text-[10.5px] leading-5 text-fg-soft">
                  These results are simulation-based estimates from a lumped-capacitance thermal model.
                  They are not laboratory measurements — real performance depends on refrigerant charge,
                  airflow, installation quality and control firmware.
                </p>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function VerdictTile({
  label,
  value,
  detail,
  tone,
}: {
  label: string
  value: string
  detail: string
  tone: 'accent' | 'success' | 'violet'
}) {
  const tones = {
    accent: 'border-accent/25 bg-card/80 text-accent',
    success: 'border-success/25 bg-card/80 text-success',
    violet: 'border-violet/25 bg-card/80 text-violet',
  }
  return (
    <div className={cn('rounded-xl border p-3 backdrop-blur', tones[tone])}>
      <p className="text-[9.5px] font-semibold tracking-[0.12em] uppercase opacity-80">{label}</p>
      <p className="mt-1 text-[14px] font-semibold text-fg">{value}</p>
      <p className="mt-0.5 text-[10.5px] text-muted">{detail}</p>
    </div>
  )
}

const TEMPERATURE_LEGEND = [
  { label: 'Inverter', color: '#38BDF8' },
  { label: 'Fixed speed', color: '#F59E0B' },
  { label: 'Target', color: '#818CF8', dashed: true },
]

function formatSwing(celsius: number): string {
  return celsius < 0.01 ? '<0.01 °C swing' : `±${celsius.toFixed(2)} °C swing`
}

function UnitCard({
  title,
  result,
  currency,
  highlight,
}: {
  title: string
  result: ComparisonResult
  currency: AppSettings['currency']
  highlight?: boolean
}) {
  const rows = [
    { label: 'Time to target', value: result.timeToTargetMin != null ? `${result.timeToTargetMin.toFixed(0)} min` : 'Not reached', icon: Timer },
    { label: 'Energy used', value: `${formatNumber(result.totalEnergyKwh, 2)} kWh`, icon: Zap },
    { label: 'Electricity cost', value: formatMoney(result.energyCost, currency), icon: TrendingDown },
    { label: 'Average power', value: `${formatNumber(result.avgPowerW)} W`, icon: Waves },
    { label: 'Compressor cycles', value: String(result.compressorCycles), icon: Snowflake },
    {
      label: 'Temp stability',
      value: result.tempStabilityC < 0.01 ? '<0.01 °C' : `±${result.tempStabilityC.toFixed(2)} °C`,
      icon: Thermometer,
    },
    { label: 'Avg modulation', value: `${result.avgModulationPct}%`, icon: ArrowUpRight },
    { label: 'Operating time', value: `${result.operatingMin} min`, icon: Timer },
  ]
  return (
    <Card className={cn('overflow-hidden', highlight && 'border-accent/30')}>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <p className="text-[12.5px] font-semibold text-fg">{title}</p>
          <p className="text-[10px] text-muted">{highlight ? 'Continuous modulation' : 'On / off cycling'}</p>
        </div>
        <Badge tone={highlight ? 'accent' : 'warning'}>{highlight ? 'INVERTER' : 'FIXED'}</Badge>
      </div>
      <div className="grid grid-cols-2 divide-x divide-y divide-line [&>*]:px-3 [&>*]:py-2.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[10px] text-muted">
              <row.icon className="size-3" />
              {row.label}
            </span>
            <span className="tnum text-[11px] font-semibold text-fg">{row.value}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
