import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART_COLORS } from '@/utils/constants'
import { ChartEmpty, ChartTooltip } from '@/components/charts/ChartKit'
import type { EnergyBucket } from '@/types'

export function EnergyChart({
  data,
  height = 200,
  highlightLast = true,
}: {
  data: EnergyBucket[]
  height?: number
  highlightLast?: boolean
}) {
  if (data.length === 0) {
    return <ChartEmpty message="No energy recorded for this period" height={height} />
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 6, left: -20, bottom: 0 }} barCategoryGap="28%">
          <defs>
            <linearGradient id="energyBar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4ADE80" stopOpacity={0.95} />
              <stop offset="100%" stopColor={CHART_COLORS.energy} stopOpacity={0.35} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="2 6" stroke="var(--border)" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            minTickGap={16}
            dy={6}
            tick={{ fontSize: 10 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={(value: number) => value.toFixed(1)}
          />
          <Tooltip
            cursor={{ fill: 'var(--accent-soft)' }}
            content={
              <ChartTooltip
                titleFormatter={(value) => String(value)}
                valueFormatter={(value) => value.toFixed(2)}
                unitMap={{ energyKwh: 'kWh' }}
                nameMap={{ energyKwh: 'Energy' }}
              />
            }
          />
          <Bar dataKey="energyKwh" radius={[3, 3, 0, 0]} isAnimationActive={false} fill="url(#energyBar)">
            {data.map((entry, index) => (
              <Cell
                key={`${entry.label}-${index}`}
                fill={highlightLast && index === data.length - 1 ? CHART_COLORS.energy : 'url(#energyBar)'}
                opacity={highlightLast && index === data.length - 1 ? 1 : 0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
