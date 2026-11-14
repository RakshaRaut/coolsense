import { useState } from 'react'
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
import type { SimulationSample } from '@/types'
import { CHART_COLORS } from '@/utils/constants'
import { formatClock, formatElapsed, formatNumber } from '@/utils/format'
import { ChartEmpty, ChartLegend, ChartTooltip } from '@/components/charts/ChartKit'
import { SegmentedControl } from '@/components/common/Select'

type Tab = 'temperature' | 'power' | 'energy'

interface SimulationChartsProps {
  series: SimulationSample[]
  live: boolean
  height?: number
  defaultTab?: Tab
}

export function SimulationCharts({ series, live, height = 250, defaultTab = 'temperature' }: SimulationChartsProps) {
  const [tab, setTab] = useState<Tab>(defaultTab)

  const tick = (value: number | string) =>
    live ? formatElapsed(Number(value)) : formatClock(String(value))

  const title = (value: number | string) =>
    live
      ? `Simulated +${formatElapsed(Number(value))}`
      : `${formatClock(String(value))}`

  if (series.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex justify-between">
          <Tabs tab={tab} setTab={setTab} />
        </div>
        <ChartEmpty message="Start the simulation to stream live samples" height={height} />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs tab={tab} setTab={setTab} />
        <ChartLegend
          items={
            tab === 'temperature'
              ? [
                  { label: 'Room', color: CHART_COLORS.room },
                  { label: 'Target', color: CHART_COLORS.target, dashed: true },
                  { label: 'Outside', color: CHART_COLORS.outside, dashed: true },
                ]
              : tab === 'power'
                ? [
                    { label: 'Power draw', color: CHART_COLORS.power },
                    { label: 'Cooling output', color: CHART_COLORS.compressor },
                  ]
                : [
                    { label: 'Energy', color: CHART_COLORS.energy },
                    { label: 'Compressor %', color: CHART_COLORS.compressor, dashed: true },
                  ]
          }
        />
      </div>

      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series} margin={{ top: 6, right: 4, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="simRoom" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.room} stopOpacity={0.3} />
                <stop offset="100%" stopColor={CHART_COLORS.room} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="simPower" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.power} stopOpacity={0.28} />
                <stop offset="100%" stopColor={CHART_COLORS.power} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="simEnergy" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.energy} stopOpacity={0.28} />
                <stop offset="100%" stopColor={CHART_COLORS.energy} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="2 6" stroke="var(--border)" />
            <XAxis
              dataKey={live ? 'elapsedSec' : 'time'}
              tickFormatter={tick}
              axisLine={false}
              tickLine={false}
              minTickGap={44}
              dy={6}
            />
            <YAxis
              yAxisId="left"
              axisLine={false}
              tickLine={false}
              width={50}
              tickFormatter={(value: number) =>
                tab === 'temperature' ? `${value.toFixed(0)}°` : tab === 'power' ? `${(value / 1000).toFixed(1)}k` : value.toFixed(2)
              }
            />
            {tab === 'power' ? (
              <YAxis
                yAxisId="right"
                orientation="right"
                axisLine={false}
                tickLine={false}
                width={36}
                tickFormatter={(value: number) => `${value.toFixed(1)}`}
              />
            ) : null}
            {tab === 'energy' ? (
              <YAxis
                yAxisId="right"
                orientation="right"
                axisLine={false}
                tickLine={false}
                width={36}
                domain={[0, 100]}
                tickFormatter={(value: number) => `${value}%`}
              />
            ) : null}

            <Tooltip
              cursor={{ stroke: 'var(--border-strong)', strokeDasharray: '3 3' }}
              content={
                <ChartTooltip
                  titleFormatter={title}
                  valueFormatter={(value, key) =>
                    key === 'compressorModulation'
                      ? value.toFixed(0)
                      : key === 'powerW'
                        ? value.toFixed(0)
                        : value.toFixed(2)
                  }
                  unitMap={{
                    roomTempC: '°C',
                    targetTempC: '°C',
                    outsideTempC: '°C',
                    powerW: 'W',
                    coolingKw: 'kW',
                    energyKwh: 'kWh',
                    compressorModulation: '%',
                  }}
                  nameMap={{
                    roomTempC: 'Room',
                    targetTempC: 'Target',
                    outsideTempC: 'Outside',
                    powerW: 'Power',
                    coolingKw: 'Cooling',
                    energyKwh: 'Energy',
                    compressorModulation: 'Compressor',
                  }}
                />
              }
            />

            {tab === 'temperature' ? (
              <>
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="roomTempC"
                  stroke={CHART_COLORS.room}
                  strokeWidth={2.2}
                  fill="url(#simRoom)"
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="left"
                  type="stepAfter"
                  dataKey="targetTempC"
                  stroke={CHART_COLORS.target}
                  strokeWidth={1.4}
                  strokeDasharray="4 4"
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="outsideTempC"
                  stroke={CHART_COLORS.outside}
                  strokeWidth={1.2}
                  strokeDasharray="6 5"
                  dot={false}
                  isAnimationActive={false}
                />
              </>
            ) : null}

            {tab === 'power' ? (
              <>
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="powerW"
                  stroke={CHART_COLORS.power}
                  strokeWidth={2}
                  fill="url(#simPower)"
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="coolingKw"
                  stroke={CHART_COLORS.compressor}
                  strokeWidth={1.6}
                  dot={false}
                  isAnimationActive={false}
                />
              </>
            ) : null}

            {tab === 'energy' ? (
              <>
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="energyKwh"
                  stroke={CHART_COLORS.energy}
                  strokeWidth={2}
                  fill="url(#simEnergy)"
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="right"
                  type="stepAfter"
                  dataKey="compressorModulation"
                  stroke={CHART_COLORS.compressor}
                  strokeWidth={1.3}
                  strokeDasharray="3 3"
                  dot={false}
                  isAnimationActive={false}
                />
              </>
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-line bg-card-2/50 px-3 py-2 text-[10.5px] text-muted">
        <span>
          {series.length} samples · last{' '}
          <span className="tnum font-semibold text-fg-soft">
            {formatNumber(series[series.length - 1].roomTempC, 1)}°C
          </span>
        </span>
        <span className="tnum">
          {formatNumber(series[series.length - 1].powerW)} W ·{' '}
          {series[series.length - 1].energyKwh.toFixed(3)} kWh
        </span>
      </div>
    </div>
  )
}

function Tabs({ tab, setTab }: { tab: Tab; setTab: (tab: Tab) => void }) {
  return (
    <SegmentedControl
      value={tab}
      onChange={(value) => setTab(value as Tab)}
      options={[
        { value: 'temperature', label: 'Temperature' },
        { value: 'power', label: 'Power & cooling' },
        { value: 'energy', label: 'Energy' },
      ]}
      ariaLabel="Simulation chart"
    />
  )
}
