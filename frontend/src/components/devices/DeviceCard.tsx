import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  Fan,
  Gauge,
  MoreVertical,
  Pencil,
  Power,
  Snowflake,
  Thermometer,
  Trash2,
  Wind,
  Zap,
} from 'lucide-react'
import type { AcDevice } from '@/types'
import { cn, formatEnergy, formatPower, formatTemp } from '@/utils/format'
import { DEVICE_TYPE_LABEL, FAN_META, MODE_META } from '@/utils/constants'
import { useSettings } from '@/contexts/SettingsProvider'
import { CompressorBadge, DeviceStatusBadge } from './DeviceStatusBadge'
import { useState } from 'react'

interface DeviceCardProps {
  device: AcDevice
  onEdit: (device: AcDevice) => void
  onDelete: (device: AcDevice) => void
  onTogglePower: (device: AcDevice) => void
  busy?: boolean
}

export function DeviceCard({ device, onEdit, onDelete, onTogglePower, busy }: DeviceCardProps) {
  const { settings } = useSettings()
  const [menuOpen, setMenuOpen] = useState(false)
  const power = formatPower(device.state.powerW)
  const energy = formatEnergy(device.state.energyKwh)
  const ModeIcon = MODE_META[device.state.mode].icon
  const active = device.state.online && device.state.power

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-all duration-200',
        active ? 'border-accent/25' : 'border-line',
        'hover:border-line-strong hover:shadow-[0_20px_44px_-34px_rgb(2_6_23/0.9)]',
      )}
    >
      {active ? (
        <div className="absolute inset-x-0 top-0 h-[2px] bg-[linear-gradient(90deg,transparent,var(--accent),transparent)] opacity-80" />
      ) : null}

      <div className="flex items-start gap-3 p-4 pb-3">
        <span
          className={cn(
            'relative grid size-10 shrink-0 place-items-center rounded-xl border',
            active ? 'border-accent/25 bg-accent-soft text-accent' : 'border-line bg-card-2 text-muted',
          )}
        >
          <Snowflake className={cn('size-5', active && 'animate-[spin-slow_10s_linear_infinite]')} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Link
              to={`/devices/${device.id}`}
              className="truncate text-[13.5px] font-semibold text-fg transition hover:text-accent"
            >
              {device.name}
            </Link>
            <ArrowUpRight className="size-3 shrink-0 text-muted opacity-0 transition group-hover:opacity-100" />
          </div>
          <p className="truncate text-[10.5px] text-muted">
            {device.brand} · {device.modelName}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1">
            <DeviceStatusBadge device={device} />
            <CompressorBadge device={device} />
          </div>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-md p-1.5 text-muted transition hover:bg-card-2 hover:text-fg"
            aria-label="Device actions"
          >
            <MoreVertical className="size-4" />
          </button>
          {menuOpen ? (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
              <div className="absolute top-full right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-line bg-elevated py-1 shadow-pop">
                <Link
                  to={`/devices/${device.id}`}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-1.5 text-[11.5px] text-fg-soft transition hover:bg-card-2"
                >
                  <Gauge className="size-3.5 text-muted" /> View details
                </Link>
                <Link
                  to={`/control?device=${device.id}`}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-1.5 text-[11.5px] text-fg-soft transition hover:bg-card-2"
                >
                  <Power className="size-3.5 text-muted" /> Open control
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onEdit(device)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11.5px] text-fg-soft transition hover:bg-card-2"
                >
                  <Pencil className="size-3.5 text-muted" /> Edit device
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onDelete(device)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11.5px] text-danger transition hover:bg-danger-soft"
                >
                  <Trash2 className="size-3.5" /> Delete device
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 pb-3">
        <div className="rounded-lg border border-line bg-card-2/60 px-2.5 py-2">
          <p className="flex items-center gap-1 text-[9.5px] font-medium tracking-wide text-muted uppercase">
            <Thermometer className="size-3" /> Room
          </p>
          <p className="tnum mt-1 text-[19px] leading-none font-semibold text-fg">
            {formatTemp(device.state.roomTempC, settings.temperatureUnit)}
          </p>
          <p className="mt-1 text-[10px] text-muted">
            target {formatTemp(device.state.targetTempC, settings.temperatureUnit)}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-card-2/60 px-2.5 py-2">
          <p className="flex items-center gap-1 text-[9.5px] font-medium tracking-wide text-muted uppercase">
            <Zap className="size-3" /> Power
          </p>
          <p className="tnum mt-1 text-[19px] leading-none font-semibold text-fg">
            {power.value}
            <span className="ml-0.5 text-[10px] font-medium text-muted">{power.unit}</span>
          </p>
          <p className="mt-1 text-[10px] text-muted">
            {energy.value} {energy.unit} today
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 border-t border-line px-4 py-2.5 text-[10.5px]">
        <span className="flex items-center gap-1.5 text-muted">
          <ModeIcon className="size-3 text-accent" />
          <span className="truncate font-medium text-fg-soft capitalize">{device.state.mode}</span>
        </span>
        <span className="flex items-center gap-1.5 text-muted">
          <Fan className="size-3 text-violet" />
          <span className="truncate font-medium text-fg-soft">{FAN_META[device.state.fanSpeed].label}</span>
        </span>
        <span className="flex items-center gap-1.5 text-muted">
          <Wind className="size-3 text-success" />
          <span className="truncate font-medium text-fg-soft">{DEVICE_TYPE_LABEL[device.type]}</span>
        </span>
      </div>

      <div className="mt-auto flex items-center gap-1 border-t border-line bg-card-2/40 px-2 py-1.5">
        <button
          type="button"
          disabled={!device.state.online || busy}
          onClick={() => onTogglePower(device)}
          className={cn(
            'flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md text-[10.5px] font-semibold transition disabled:opacity-40',
            device.state.power
              ? 'text-success hover:bg-success-soft'
              : 'text-muted hover:bg-card hover:text-fg',
          )}
        >
          <Power className="size-3" />
          {device.state.power ? 'Turn off' : 'Turn on'}
        </button>
        <Link
          to={`/control?device=${device.id}`}
          className="flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md text-[10.5px] font-medium text-muted transition hover:bg-card hover:text-fg"
        >
          <Gauge className="size-3" /> Control
        </Link>
      </div>
    </div>
  )
}
