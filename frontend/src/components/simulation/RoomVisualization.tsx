import { cn, formatTemp } from '@/utils/format'
import type { AcDevice } from '@/types'
import { useSettings } from '@/contexts/SettingsProvider'

interface RoomVisualizationProps {
  device: AcDevice
  running: boolean
}

export function RoomVisualization({ device, running }: RoomVisualizationProps) {
  const { settings } = useSettings()
  const { state, environment } = device
  const active = state.power && state.compressorOn
  const intensity = active ? Math.max(0.25, state.compressorModulation / 100) : 0
  const delta = state.roomTempC - state.targetTempC
  const hot = delta > 0.6
  const cold = delta < -0.6

  const tempColor = hot ? 'var(--warning)' : cold ? 'var(--violet)' : 'var(--accent)'
  const ventLines = Array.from({ length: 4 })

  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-[linear-gradient(180deg,var(--card-2),var(--card))]">
      {/* ambient glow */}
      <div
        className={cn(
          'pointer-events-none absolute -top-20 right-10 size-64 rounded-full blur-3xl transition-opacity duration-1000',
          active ? 'bg-accent/20 opacity-100' : 'opacity-0',
        )}
      />

      <svg viewBox="0 0 680 330" className="relative block h-auto w-full" role="img" aria-label="Simulated room">
        <defs>
          <linearGradient id="roomWall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--elevated)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--card-2)" stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="windowSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="airflow" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7DD3FC" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#7DD3FC" stopOpacity="0.1" />
          </linearGradient>
          <radialGradient id="ventGlow">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Room shell */}
        <rect x="14" y="10" width="652" height="308" rx="18" fill="url(#roomWall)" stroke="var(--border)" strokeWidth="1.2" />

        {/* Floor */}
        <path d="M14 244 H666 V300 a18 18 0 0 1 -18 18 H32 a18 18 0 0 1 -18 -18 Z" fill="var(--card)" opacity="0.55" />
        {[0, 1, 2, 3, 4].map((i) => (
          <line
            key={i}
            x1={14 + i * 163}
            y1="244"
            x2={80 + i * 163}
            y2="318"
            stroke="var(--border)"
            strokeOpacity="0.55"
          />
        ))}
        <line x1="14" y1="244" x2="666" y2="244" stroke="var(--border)" strokeWidth="1.4" />

        {/* Window with outside heat */}
        <g>
          <rect x="52" y="58" width="122" height="98" rx="9" fill="url(#windowSky)" stroke="var(--border)" strokeWidth="2" />
          <line x1="113" y1="58" x2="113" y2="156" stroke="var(--border)" strokeWidth="1.5" />
          <line x1="52" y1="107" x2="174" y2="107" stroke="var(--border)" strokeWidth="1.5" />
          <circle cx="146" cy="82" r="9" fill="#FCD34D" opacity="0.85" />
          <path d="M52 156 L174 156" stroke="var(--border-strong)" strokeWidth="4" strokeLinecap="round" />
          {/* heat shimmer */}
          {environment.outsideTempC > 30
            ? [0, 1, 2].map((i) => (
                <path
                  key={i}
                  d={`M${78 + i * 26} 146 q 6 -8 0 -16 q -6 -8 0 -16`}
                  fill="none"
                  stroke="var(--warning)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  opacity={0.35 + i * 0.1}
                  className="animate-drift"
                  style={{ animationDuration: `${4 + i}s`, animationDelay: `${i * 0.5}s` }}
                />
              ))
            : null}
          <text x="113" y="176" textAnchor="middle" fontSize="9" fill="var(--muted)">
            outside {formatTemp(environment.outsideTempC, settings.temperatureUnit)}
          </text>
        </g>

        {/* Desk + occupant silhouettes */}
        <g opacity="0.9">
          <rect x="236" y="212" width="132" height="7" rx="3.5" fill="var(--border-strong)" />
          <rect x="244" y="219" width="5" height="25" rx="2" fill="var(--border)" />
          <rect x="355" y="219" width="5" height="25" rx="2" fill="var(--border)" />
          <rect x="256" y="198" width="34" height="14" rx="2" fill="var(--elevated)" stroke="var(--border)" />
          {Array.from({ length: Math.min(3, environment.occupancy) }).map((_, i) => (
            <g key={i} transform={`translate(${300 + i * 26}, 196)`}>
              <circle cx="0" cy="0" r="6" fill="var(--violet)" opacity="0.55" />
              <rect x="-7" y="8" width="14" height="18" rx="6" fill="var(--violet)" opacity="0.35" />
            </g>
          ))}
        </g>

        {/* AC unit */}
        <g transform="translate(452,44)">
          <rect
            x="0"
            y="0"
            width="176"
            height="62"
            rx="14"
            fill="var(--card)"
            stroke={active ? 'var(--accent)' : 'var(--border)'}
            strokeOpacity={active ? 0.65 : 1}
            strokeWidth="1.5"
          />
          <rect x="0" y="0" width="176" height="62" rx="14" fill="url(#ventGlow)" opacity={active ? 0.5 : 0} />
          {ventLines.map((_, i) => (
            <rect
              key={i}
              x="16"
              y={18 + i * 9}
              width={104 - i * 6}
              height="3"
              rx="1.5"
              fill={active ? 'var(--accent)' : 'var(--muted)'}
              opacity={active ? 0.35 + i * 0.12 : 0.28}
            />
          ))}
          <text x="16" y="52" fontSize="8" fill="var(--muted)" letterSpacing="1">
            {device.modelName.toUpperCase()}
          </text>
          <circle cx="156" cy="20" r="3.5" fill={active ? 'var(--success)' : 'var(--muted)'} />
          <text x="156" y="36" fontSize="7.5" textAnchor="middle" fill="var(--muted)">
            {state.power ? 'ON' : 'OFF'}
          </text>
        </g>

        {/* Airflow */}
        <g opacity={active ? 0.25 + intensity * 0.65 : 0.08} className="transition-opacity duration-700">
          {[0, 1, 2, 3].map((i) => (
            <path
              key={i}
              d={`M${470 + i * 22} 108 C ${430 - i * 26} 160, ${360 - i * 10} 190, ${300 - i * 34} 250`}
              fill="none"
              stroke="url(#airflow)"
              strokeWidth={2.4 - i * 0.3}
              strokeLinecap="round"
              strokeDasharray="9 14"
              className={active ? 'animate-[airflow_1.6s_linear_infinite]' : undefined}
              style={{ animationDelay: `${i * 0.18}s`, animationDuration: `${1.2 + i * 0.2}s` }}
            />
          ))}
        </g>

        {/* Thermometer */}
        <g transform="translate(612,96)">
          <rect x="0" y="0" width="16" height="112" rx="8" fill="var(--card)" stroke="var(--border)" />
          <rect
            x="3.5"
            y={105 - ((state.roomTempC - 12) / 30) * 96}
            width="9"
            height={((state.roomTempC - 12) / 30) * 96}
            rx="4.5"
            fill={state.roomTempC > state.targetTempC + 0.6 ? 'var(--warning)' : 'var(--accent)'}
            className="transition-all duration-700"
          />
          <circle cx="8" cy="118" r="9" fill={tempColor} opacity="0.85" />
        </g>
      </svg>

      {/* Overlay: live readings */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
        <div className="flex items-start justify-between">
          <div className="flex flex-wrap gap-1.5">
            <span className="flex items-center gap-1.5 rounded-md border border-line bg-card/80 px-2 py-1 text-[9.5px] font-semibold tracking-wide text-muted uppercase backdrop-blur">
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  running ? 'animate-pulse bg-success' : 'bg-muted',
                )}
              />
              {running ? 'Live simulation' : 'Paused scene'}
            </span>
            <span className="rounded-md border border-line bg-card/80 px-2 py-1 text-[9.5px] font-semibold tracking-wide text-muted uppercase backdrop-blur">
              {environment.areaM2} m² · {environment.occupancy} ppl
            </span>
          </div>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="rounded-xl border border-line bg-card/85 px-3 py-2 backdrop-blur">
            <p className="text-[8.5px] font-semibold tracking-[0.16em] text-muted uppercase">Room</p>
            <p className="tnum mt-0.5 text-[26px] leading-none font-semibold tracking-tight" style={{ color: tempColor }}>
              {formatTemp(state.roomTempC, settings.temperatureUnit)}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <span className="rounded-lg border border-line bg-card/85 px-2.5 py-1 text-[10px] font-medium text-fg-soft backdrop-blur">
              Target{' '}
              <span className="tnum font-semibold text-accent">
                {formatTemp(state.targetTempC, settings.temperatureUnit)}
              </span>
            </span>
            <span className="rounded-lg border border-line bg-card/85 px-2.5 py-1 text-[10px] font-medium text-fg-soft backdrop-blur">
              {active ? (
                <>
                  Cooling{' '}
                  <span className="tnum font-semibold text-accent">{state.coolingOutputKw.toFixed(2)} kW</span>
                </>
              ) : (
                <span className="text-muted">Compressor idle</span>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
