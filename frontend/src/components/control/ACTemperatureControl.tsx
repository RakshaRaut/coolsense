import { Minus, Plus } from 'lucide-react'
import { cn, clamp, formatTemp } from '@/utils/format'
import type { AppSettings } from '@/types'

interface ACTemperatureControlProps {
  target: number
  room: number
  min: number
  max: number
  active: boolean
  pending?: boolean
  unit: AppSettings['temperatureUnit']
  onAdjust: (value: number) => void
  onSlide: (value: number) => void
  onCommitSlide: (value: number) => void
}

const RADIUS = 84
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function ACTemperatureControl({
  target,
  room,
  min,
  max,
  active,
  pending,
  unit,
  onAdjust,
  onSlide,
  onCommitSlide,
}: ACTemperatureControlProps) {
  const progress = clamp((target - min) / (max - min), 0, 1)
  const roomProgress = clamp((room - min) / (max - min), 0, 1)

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex items-center justify-center gap-3 sm:gap-6">
        <button
          type="button"
          onClick={() => onAdjust(target - 0.5)}
          disabled={target <= min}
          className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-card-2 text-fg transition hover:border-accent/50 hover:bg-accent-soft hover:text-accent active:scale-95 disabled:opacity-30 sm:size-12"
          aria-label="Decrease target temperature"
        >
          <Minus className="size-5" />
        </button>

        <div className="relative size-[228px] sm:size-[262px]">
          <div
            className={cn(
              'absolute inset-6 rounded-full blur-2xl transition-opacity duration-700',
              active ? 'bg-[radial-gradient(circle,var(--accent-soft),transparent_70%)] opacity-100' : 'opacity-0',
            )}
          />
          <svg viewBox="0 0 200 200" className="relative size-full -rotate-90">
            <defs>
              <linearGradient id="dialGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="100%" stopColor="#818CF8" />
              </linearGradient>
            </defs>
            <circle cx="100" cy="100" r={RADIUS} fill="none" stroke="var(--border)" strokeWidth="9" />
            <circle
              cx="100"
              cy="100"
              r={RADIUS}
              fill="none"
              stroke="url(#dialGradient)"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={`${progress * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              className="transition-[stroke-dasharray] duration-500 ease-out"
              opacity={active ? 1 : 0.45}
            />
            {/* current room temperature marker */}
            <circle
              cx="100"
              cy={100 - RADIUS}
              r="4.5"
              fill="var(--fg-soft)"
              stroke="var(--card)"
              strokeWidth="2"
              transform={`rotate(${roomProgress * 360} 100 100)`}
              className="transition-transform duration-700"
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-[9.5px] font-semibold tracking-[0.18em] text-muted uppercase">Target</p>
            <div className="mt-1 flex items-start">
              <span
                className={cn(
                  'tnum text-[56px] leading-none font-semibold tracking-[-0.05em] transition-colors sm:text-[62px]',
                  active ? 'text-fg' : 'text-muted',
                )}
              >
                {target.toFixed(1)}
              </span>
              <span className="mt-2 ml-1 text-lg font-medium text-muted">°</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 rounded-full border border-line bg-card-2 px-2.5 py-1">
              <span className="size-1.5 rounded-full bg-accent" />
              <span className="tnum text-[10.5px] font-medium text-muted">
                Room {formatTemp(room, unit)}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onAdjust(target + 0.5)}
          disabled={target >= max}
          className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-card-2 text-fg transition hover:border-accent/50 hover:bg-accent-soft hover:text-accent active:scale-95 disabled:opacity-30 sm:size-12"
          aria-label="Increase target temperature"
        >
          <Plus className="size-5" />
        </button>
      </div>

      <div className="w-full max-w-md">
        <input
          type="range"
          min={min}
          max={max}
          step={0.5}
          value={target}
          aria-label="Target temperature"
          onChange={(event) => onSlide(Number(event.target.value))}
          onPointerUp={(event) => onCommitSlide(Number((event.target as HTMLInputElement).value))}
          onKeyUp={(event) => onCommitSlide(Number((event.target as HTMLInputElement).value))}
          style={{ ['--range-progress' as string]: `${progress * 100}%` }}
          className={cn(pending && 'opacity-70')}
        />
        <div className="mt-1 flex items-center justify-between text-[10px] font-medium text-muted">
          <span>{min}°</span>
          <span className="tracking-[0.1em] uppercase">Set point</span>
          <span>{max}°</span>
        </div>
      </div>
    </div>
  )
}
