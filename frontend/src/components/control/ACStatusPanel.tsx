import { Activity, Droplets, Fan, Gauge, Snowflake, Thermometer, Zap } from 'lucide-react'
import type { AcDevice } from '@/types'
import { FAN_META, MODE_META } from '@/utils/constants'
import { cn, formatEnergy, formatPower, formatTemp, formatTimeWithSeconds } from '@/utils/format'
import { useSettings } from '@/contexts/SettingsProvider'
import { Badge } from '@/components/common/Badge'

export function ACStatusPanel({ device }: { device: AcDevice }) {
  const { settings } = useSettings()
  const { state } = device
  const power = formatPower(state.powerW)
  const energy = formatEnergy(state.energyKwh)
  const modulation = state.compressorOn ? state.compressorModulation : 0
  const circumference = 2 * Math.PI * 34

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl border border-line bg-card-2/60 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9.5px] font-semibold tracking-[0.14em] text-muted uppercase">Compressor</p>
            <p className={cn('mt-1 text-[15px] font-semibold', state.compressorOn ? 'text-accent' : 'text-muted')}>
              {state.compressorOn ? (device.inverter ? 'Modulating' : 'Full load') : 'Idle'}
            </p>
            <p className="mt-1 text-[10.5px] text-muted">
              {device.inverter ? `Inverter · ${modulation}% output` : 'Fixed speed · on / off cycling'}
            </p>
          </div>

          <div className="relative size-[88px]">
            <svg viewBox="0 0 80 80" className="size-full -rotate-90">
              <circle cx="40" cy="40" r="34" fill="none" stroke="var(--border)" strokeWidth="6" />
              <circle
                cx="40"
                cy="40"
                r="34"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${(modulation / 100) * circumference} ${circumference}`}
                className="transition-[stroke-dasharray] duration-700"
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <span className="tnum text-[15px] font-semibold text-fg">{modulation}%</span>
            </div>
          </div>
        </div>

        <div className="mt-3 h-1 overflow-hidden rounded-full bg-border/60">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#38BDF8,#818CF8)] transition-all duration-700"
            style={{ width: `${Math.max(modulation, 2)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Reading icon={<Zap className="size-3.5" />} label="Power draw" value={power.value} unit={power.unit} />
        <Reading icon={<Gauge className="size-3.5" />} label="Energy today" value={energy.value} unit={energy.unit} />
        <Reading
          icon={<Snowflake className="size-3.5" />}
          label="Cooling output"
          value={state.coolingOutputKw.toFixed(2)}
          unit="kW"
        />
        <Reading
          icon={<Thermometer className="size-3.5" />}
          label="Room / target"
          value={`${formatTemp(state.roomTempC, settings.temperatureUnit)}`}
          unit={`/ ${formatTemp(state.targetTempC, settings.temperatureUnit)}`}
        />
        <Reading icon={<Droplets className="size-3.5" />} label="Humidity" value={state.humidityPct.toFixed(0)} unit="%" />
        <Reading
          icon={<Fan className="size-3.5" />}
          label="Fan"
          value={FAN_META[state.fanSpeed].label}
          unit={state.fanSpeed === 'auto' ? '' : `${FAN_META[state.fanSpeed].powerW}W`}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-line bg-card-2/40 px-3 py-2">
        <span className="flex items-center gap-2 text-[10.5px] text-muted">
          <Activity className="size-3.5 text-success" />
          {MODE_META[state.mode].label} mode
        </span>
        <span className="tnum text-[10px] text-muted">{formatTimeWithSeconds(state.updatedAt)}</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge tone={state.power ? 'success' : 'neutral'} dot>
          AC {state.power ? 'ON' : 'OFF'}
        </Badge>
        <Badge tone={state.compressorOn ? 'accent' : 'neutral'} dot>
          Compressor {state.compressorOn ? 'ON' : 'OFF'}
        </Badge>
        <Badge tone={state.online ? 'success' : 'danger'} dot>
          {state.online ? 'Online' : 'Offline'}
        </Badge>
      </div>
    </div>
  )
}

function Reading({
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
    <div className="rounded-lg border border-line bg-card px-2.5 py-2">
      <p className="flex items-center gap-1.5 text-[9.5px] font-medium tracking-wide text-muted uppercase">
        <span className="text-accent">{icon}</span>
        {label}
      </p>
      <p className="tnum mt-1 text-[13.5px] leading-none font-semibold text-fg">
        {value}
        {unit ? <span className="ml-1 text-[10px] font-medium text-muted">{unit}</span> : null}
      </p>
    </div>
  )
}
