import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART_COLORS } from '@/utils/constants'
import { formatClock } from '@/utils/format'
import { ChartEmpty, ChartTooltip } from '@/components/charts/ChartKit'
import type { FleetPoint } from '@/api/dashboard.api'

export function PowerChart({ data, height = 200 }: { data: FleetPoint[]; height?: number }) {
  if (data.length === 0) {
    return <ChartEmpty message="Power history will appear once the fleet is running" height={height} />
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 8, left: -4, bottom: 0 }}>
          <defs>
            <linearGradient id="powerFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.power} stopOpacity={0.28} />
              <stop offset="100%" stopColor={CHART_COLORS.power} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="2 6" stroke="var(--border)" />
          <XAxis
            dataKey="time"
            tickFormatter={(value: string) => formatClock(value)}
            axisLine={false}
            tickLine={false}
            minTickGap={40}
            dy={6}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={56}
            tickFormatter={(value: number) => `${(value / 1000).toFixed(1)}k`}
          />
          <Tooltip
            cursor={{ stroke: 'var(--border-strong)', strokeDasharray: '3 3' }}
            content={
              <ChartTooltip
                titleFormatter={(value) => formatClock(String(value))}
                valueFormatter={(value) => value.toFixed(0)}
                unitMap={{ powerW: 'W' }}
                nameMap={{ powerW: 'Fleet power' }}
              />
            }
          />
          <Area
            type="monotone"
            dataKey="powerW"
            stroke={CHART_COLORS.power}
            strokeWidth={1.8}
            fill="url(#powerFill)"
            dot={false}
            activeDot={{ r: 3, strokeWidth: 2, stroke: 'var(--card)' }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
