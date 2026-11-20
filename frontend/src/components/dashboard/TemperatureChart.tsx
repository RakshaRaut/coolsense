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
import { CHART_COLORS, TIME_RANGES } from '@/utils/constants'
import { formatClock, formatDate } from '@/utils/format'
import { ChartEmpty, ChartTooltip } from '@/components/charts/ChartKit'
import { SegmentedControl } from '@/components/common/Select'
import type { FleetPoint } from '@/api/dashboard.api'

export type TimeRange = (typeof TIME_RANGES)[number]['value']

interface TemperatureChartProps {
  data: Array<Pick<FleetPoint, 'time' | 'roomTempC' | 'targetTempC' | 'outsideTempC'>>
  height?: number
  range?: TimeRange
  onRangeChange?: (range: TimeRange) => void
  showTarget?: boolean
  showOutside?: boolean
}

function tickFor(range: TimeRange, value: string) {
  if (range === '7d') return formatDate(value, { weekday: 'short' })
  return formatClock(value)
}

function tooltipTitle(range: TimeRange, value: string | number) {
  if (range === '7d') return formatDate(String(value), { weekday: 'short', month: 'short', day: 'numeric' })
  return `${formatDate(String(value), { month: 'short', day: 'numeric' })} · ${formatClock(String(value))}`
}

export function TemperatureChart({
  data,
  height = 260,
  range = '24h',
  onRangeChange,
  showTarget = true,
  showOutside = false,
}: TemperatureChartProps) {
  if (data.length === 0) {
    return <ChartEmpty message="No temperature samples yet — start a simulation" height={height} />
  }

  return (
    <div className="space-y-3">
      {onRangeChange ? (
        <div className="flex justify-end">
          <SegmentedControl
            value={range}
            onChange={(value) => onRangeChange(value as TimeRange)}
            options={TIME_RANGES.map((r) => ({ value: r.value, label: r.label }))}
            ariaLabel="Temperature time range"
          />
        </div>
      ) : null}
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="roomTempFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.room} stopOpacity={0.32} />
                <stop offset="70%" stopColor={CHART_COLORS.room} stopOpacity={0.04} />
                <stop offset="100%" stopColor={CHART_COLORS.room} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="2 6" stroke="var(--border)" />
            <XAxis
              dataKey="time"
              tickFormatter={(value: string) => tickFor(range, value)}
              axisLine={false}
              tickLine={false}
              minTickGap={36}
              dy={6}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={52}
              domain={['dataMin - 1', 'dataMax + 1']}
              tickFormatter={(value: number) => `${value.toFixed(0)}°`}
            />
            <Tooltip
              cursor={{ stroke: 'var(--border-strong)', strokeDasharray: '3 3' }}
              content={
                <ChartTooltip
                  titleFormatter={(value) => tooltipTitle(range, value)}
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
              fill="url(#roomTempFill)"
              dot={false}
              activeDot={{ r: 3.5, strokeWidth: 2, stroke: 'var(--card)' }}
              isAnimationActive={false}
            />
            {showTarget ? (
              <Line
                type="stepAfter"
                dataKey="targetTempC"
                stroke={CHART_COLORS.target}
                strokeWidth={1.4}
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={false}
              />
            ) : null}
            {showOutside ? (
              <Line
                type="monotone"
                dataKey="outsideTempC"
                stroke={CHART_COLORS.outside}
                strokeWidth={1.2}
                strokeDasharray="6 5"
                dot={false}
                isAnimationActive={false}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
