import { Activity, Clock, Cpu, Gauge, Timer, Zap } from 'lucide-react'
import type { AcDevice, SimulationSession } from '@/types'
import { cn, formatDuration, formatElapsed, formatNumber, formatTimeWithSeconds } from '@/utils/format'
import { Badge, StatusDot } from '@/components/common/Badge'

export function SimulationStatus({
  session,
  device,
  sampleCount,
}: {
  session: SimulationSession | null
  device: AcDevice
  sampleCount: number
}) {
  const status = session?.status ?? 'idle'
  const running = status === 'running'
  const elapsed = session?.elapsedSec ?? 0

  return (
    <div className="divide-y divide-line">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="flex items-center gap-2 text-[11px] text-muted">
          <Activity className="size-3.5 text-accent" /> Status
        </span>
        <Badge tone={running ? 'success' : status === 'paused' ? 'warning' : 'neutral'} dot>
          <span className="capitalize">{status}</span>
        </Badge>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="flex items-center gap-2 text-[11px] text-muted">
          <Cpu className="size-3.5" /> Device
        </span>
        <span className="max-w-[60%] truncate text-right text-[11.5px] font-medium text-fg">{device.name}</span>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="flex items-center gap-2 text-[11px] text-muted">
          <Timer className="size-3.5" /> Elapsed
        </span>
        <span className="tnum text-[11.5px] font-semibold text-fg">
          {formatElapsed(elapsed)}
          <span className="ml-1 text-[10px] font-medium text-muted">
            ({formatDuration(elapsed / 60)} simulated)
          </span>
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="flex items-center gap-2 text-[11px] text-muted">
          <Gauge className="size-3.5" /> Speed
        </span>
        <span className="tnum text-[11.5px] font-semibold text-accent">×{session?.speed ?? 30}</span>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="flex items-center gap-2 text-[11px] text-muted">
          <Clock className="size-3.5" /> Samples
        </span>
        <span className="tnum text-[11.5px] font-medium text-fg">
          {sampleCount} <span className="text-[10px] text-muted">@ 1 Hz</span>
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="flex items-center gap-2 text-[11px] text-muted">
          <Zap className="size-3.5" /> Energy used
        </span>
        <span className="tnum text-[11.5px] font-medium text-fg">
          {formatNumber(device.state.energyKwh, 2)} kWh
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="flex items-center gap-2 text-[11px] text-muted">
          <StatusDot tone={running ? 'success' : 'neutral'} pulse={running} /> Last tick
        </span>
        <span className="tnum text-[10.5px] text-muted">{formatTimeWithSeconds(device.state.updatedAt)}</span>
      </div>
      <p className={cn('px-4 py-3 text-[10px] leading-4 text-muted', running && 'text-success/80')}>
        {running
          ? `Physics is advancing ${session?.speed ?? 30} simulated seconds every real second.`
          : 'Start the simulation to stream live thermal and power samples.'}
      </p>
    </div>
  )
}
