import { Pause, Play, RotateCcw, Square, StopCircle } from 'lucide-react'
import type { SimulationSession } from '@/types'
import { SIM_SPEEDS } from '@/utils/constants'
import { cn, formatDuration, formatElapsed } from '@/utils/format'
import { Button } from '@/components/common/Button'
import { StatusDot } from '@/components/common/Badge'
import { SegmentedControl } from '@/components/common/Select'

interface SimulationControlsProps {
  session: SimulationSession | null
  speed: number
  busy: boolean
  canStart: boolean
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onReset: () => void
  onSpeedChange: (speed: number) => void
}

const STATUS_TONE: Record<string, string> = {
  running: 'text-success',
  paused: 'text-warning',
  idle: 'text-muted',
  finished: 'text-muted',
}

export function SimulationControls({
  session,
  speed,
  busy,
  canStart,
  onStart,
  onPause,
  onResume,
  onStop,
  onReset,
  onSpeedChange,
}: SimulationControlsProps) {
  const status = session?.status ?? 'idle'
  const running = status === 'running'
  const paused = status === 'paused'
  const started = Boolean(session) && status !== 'idle'

  return (
    <div className="surface flex flex-wrap items-center gap-3 p-3">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'grid size-9 place-items-center rounded-lg border',
            running
              ? 'border-success/30 bg-success-soft text-success'
              : paused
                ? 'border-warning/30 bg-warning-soft text-warning'
                : 'border-line bg-card-2 text-muted',
          )}
        >
          <StatusDot tone={running ? 'success' : paused ? 'warning' : 'neutral'} pulse={running} />
        </span>
        <div>
          <p className={cn('text-[11px] font-semibold tracking-[0.1em] uppercase', STATUS_TONE[status])}>
            {status === 'idle' ? 'Not running' : status}
          </p>
          <p className="tnum text-[15px] leading-tight font-semibold text-fg">
            {formatElapsed(session?.elapsedSec ?? 0)}
            <span className="ml-1.5 text-[10px] font-medium text-muted">
              simulated
            </span>
          </p>
        </div>
      </div>

      <div className="hidden h-8 w-px bg-line sm:block" />

      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">Speed</span>
        <SegmentedControl
          value={speed}
          onChange={onSpeedChange}
          options={SIM_SPEEDS.map((item) => ({ value: item.value, label: item.label }))}
          ariaLabel="Simulation speed"
        />
        <span className="hidden text-[10px] text-muted lg:inline">
          ×{speed} · {formatDuration((session?.elapsedSec ?? 0) / 60)} simulated
        </span>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        {!started ? (
          <Button
            variant="primary"
            size="sm"
            icon={<Play className="size-3.5" />}
            loading={busy}
            disabled={!canStart}
            onClick={onStart}
          >
            Start simulation
          </Button>
        ) : running ? (
          <Button variant="secondary" size="sm" icon={<Pause className="size-3.5" />} loading={busy} onClick={onPause}>
            Pause
          </Button>
        ) : (
          <Button variant="primary" size="sm" icon={<Play className="size-3.5" />} loading={busy} onClick={onResume}>
            Resume
          </Button>
        )}

        <Button
          variant="secondary"
          size="sm"
          icon={<StopCircle className="size-3.5" />}
          disabled={!started || busy}
          onClick={onStop}
        >
          Stop
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<RotateCcw className="size-3.5" />}
          disabled={!started || busy}
          onClick={onReset}
        >
          Reset
        </Button>
        {running ? (
          <span className="ml-1 hidden items-center gap-1.5 rounded-md border border-success/25 bg-success-soft px-2 py-1 text-[10px] font-semibold text-success md:flex">
            <Square className="size-2.5 animate-pulse" /> STREAMING
          </span>
        ) : null}
      </div>
    </div>
  )
}
