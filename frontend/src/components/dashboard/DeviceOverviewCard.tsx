import { Link } from 'react-router-dom'
import { ArrowUpRight, Fan, Gauge, Pencil, Power, Settings2, Snowflake, Zap } from 'lucide-react'
import type { AcDevice } from '@/types'
import { cn, formatPower, formatTemp, formatRelative } from '@/utils/format'
import { FAN_META } from '@/utils/constants'
import { Badge, StatusDot } from '@/components/common/Badge'
import { useSettings } from '@/contexts/SettingsProvider'

export function DeviceOverviewCard({ device, onEdit }: { device: AcDevice; onEdit: (device: AcDevice) => void }) {
  const { settings } = useSettings()
  const power = formatPower(device.state.powerW)
  const online = device.state.online
  const active = online && device.state.power

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-card transition-all duration-200',
        active
          ? 'border-accent/25 shadow-[0_0_0_1px_rgb(56_189_248/0.06),0_18px_40px_-32px_rgb(56_189_248/0.65)]'
          : 'border-line',
        'hover:border-line-strong',
      )}
    >
      {active ? (
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--accent),transparent)] opacity-70" />
      ) : null}

      <div className="p-4">
        <div className="flex items-start gap-2.5">
          <span
            className={cn(
              'grid size-9 shrink-0 place-items-center rounded-lg border',
              active
                ? 'border-accent/25 bg-accent-soft text-accent'
                : 'border-line bg-card-2 text-muted',
            )}
          >
            <Snowflake className={cn('size-4.5', active && 'animate-[spin-slow_9s_linear_infinite]')} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-[13px] font-semibold text-fg">{device.name}</h3>
              <StatusDot tone={online ? (active ? 'success' : 'neutral') : 'danger'} pulse={active} />
            </div>
            <p className="truncate text-[10.5px] text-muted">
              {device.environment.roomName} · {device.modelName}
            </p>
          </div>
          <Badge tone={device.inverter ? 'violet' : 'neutral'}>{device.inverter ? 'INV' : 'FIXED'}</Badge>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[9.5px] font-semibold tracking-[0.1em] text-muted uppercase">Room</p>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="tnum text-[24px] leading-none font-semibold tracking-tight text-fg">
                {formatTemp(device.state.roomTempC, settings.temperatureUnit)}
              </span>
              <span className="tnum flex items-center gap-0.5 text-[11px] font-medium text-muted">
                <ArrowUpRight className="size-3" />
                {formatTemp(device.state.targetTempC, settings.temperatureUnit)}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[9.5px] font-semibold tracking-[0.1em] text-muted uppercase">Draw</p>
            <p className="tnum mt-1 text-[15px] leading-none font-semibold text-fg">
              {power.value}
              <span className="ml-0.5 text-[10px] font-medium text-muted">{power.unit}</span>
            </p>
          </div>
        </div>

        <div className="mt-3.5 grid grid-cols-3 gap-2 border-t border-line pt-3">
          <MiniStat
            icon={<Power className="size-3" />}
            label="AC"
            value={device.state.power ? 'ON' : 'OFF'}
            tone={device.state.power ? 'success' : 'muted'}
          />
          <MiniStat
            icon={<Gauge className="size-3" />}
            label="Comp."
            value={device.state.compressorOn ? `${device.state.compressorModulation}%` : 'Idle'}
            tone={device.state.compressorOn ? 'accent' : 'muted'}
          />
          <MiniStat
            icon={<Fan className="size-3" />}
            label="Fan"
            value={FAN_META[device.state.fanSpeed].label}
            tone="muted"
          />
        </div>
      </div>

      <div className="flex items-center gap-1 border-t border-line bg-card-2/50 px-2 py-1.5">
        <Link
          to={`/devices/${device.id}`}
          className="flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md text-[10.5px] font-medium text-muted transition hover:bg-card hover:text-fg"
        >
          <Zap className="size-3" /> Details
        </Link>
        <Link
          to={`/control?device=${device.id}`}
          className="flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md text-[10.5px] font-medium text-muted transition hover:bg-card hover:text-fg"
        >
          <Settings2 className="size-3" /> Control
        </Link>
        <button
          type="button"
          onClick={() => onEdit(device)}
          className="flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md text-[10.5px] font-medium text-muted transition hover:bg-card hover:text-fg"
        >
          <Pencil className="size-3" /> Edit
        </button>
      </div>
      <span className="absolute right-3 bottom-[52px] hidden text-[9px] text-muted/70 group-hover:block">
        {formatRelative(device.state.updatedAt)}
      </span>
    </div>
  )
}

function MiniStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone: 'success' | 'accent' | 'muted'
}) {
  const tones = { success: 'text-success', accent: 'text-accent', muted: 'text-fg-soft' }
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1 text-[9.5px] font-medium text-muted">
        {icon}
        {label}
      </p>
      <p className={cn('mt-0.5 truncate text-[11.5px] font-semibold', tones[tone])}>{value}</p>
    </div>
  )
}
