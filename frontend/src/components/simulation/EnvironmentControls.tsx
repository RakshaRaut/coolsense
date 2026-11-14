import { useEffect, useRef, useState } from 'react'
import { Building2, Leaf, Sun, Users, Wind } from 'lucide-react'
import type { AcDevice, InsulationLevel, RoomEnvironment } from '@/types'
import { INSULATION_META, INSULATION_LIST } from '@/utils/constants'
import { cn, clamp, formatNumber } from '@/utils/format'
import { Slider } from '@/components/common/Slider'

interface EnvironmentControlsProps {
  device: AcDevice
  onPatch: (patch: Partial<RoomEnvironment> & { roomTempC?: number }) => void
  disabled?: boolean
}

type Draft = {
  outsideTempC: number
  humidityPct: number
  areaM2: number
  occupancy: number
  windowExposure: number
  heatGainW: number
  insulation: InsulationLevel
}

function toDraft(device: AcDevice): Draft {
  return {
    outsideTempC: device.environment.outsideTempC,
    humidityPct: device.environment.humidityPct,
    areaM2: device.environment.areaM2,
    occupancy: device.environment.occupancy,
    windowExposure: Math.round(device.environment.windowExposure * 100),
    heatGainW: device.environment.heatGainW,
    insulation: device.environment.insulation,
  }
}

export function EnvironmentControls({ device, onPatch, disabled }: EnvironmentControlsProps) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(device))
  const [roomDraft, setRoomDraft] = useState<number | null>(null)
  const timer = useRef<number | null>(null)
  const roomTimer = useRef<number | null>(null)

  useEffect(() => {
    setDraft(toDraft(device))
    // Only re-sync when a different device is selected.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device.id])

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
      if (roomTimer.current) window.clearTimeout(roomTimer.current)
    }
  }, [])

  const commit = (patch: Partial<Draft> & { roomTempC?: number }) => {
    const { roomTempC, ...rest } = patch
    if (Object.keys(rest).length > 0) {
      setDraft((prev) => ({ ...prev, ...rest }))
    }
    if (roomTempC != null) setRoomDraft(roomTempC)

    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const payload: Partial<RoomEnvironment> & { roomTempC?: number } = {}
      if (roomTempC != null) payload.roomTempC = roomTempC
      if (rest.outsideTempC != null) payload.outsideTempC = rest.outsideTempC
      if (rest.humidityPct != null) payload.humidityPct = rest.humidityPct
      if (rest.areaM2 != null) payload.areaM2 = rest.areaM2
      if (rest.occupancy != null) payload.occupancy = rest.occupancy
      if (rest.windowExposure != null) payload.windowExposure = rest.windowExposure / 100
      if (rest.heatGainW != null) payload.heatGainW = rest.heatGainW
      if (rest.insulation != null) payload.insulation = rest.insulation
      onPatch(payload)
      if (roomTempC != null) {
        if (roomTimer.current) window.clearTimeout(roomTimer.current)
        roomTimer.current = window.setTimeout(() => setRoomDraft(null), 1200)
      }
    }, 220)
  }

  const uValue = INSULATION_META[draft.insulation].uValue
  const envelopeW = uValue * 4 * Math.sqrt(draft.areaM2) * 2.7 * (draft.outsideTempC - (roomDraft ?? device.state.roomTempC))
  const solarW = (draft.windowExposure / 100) * 380
  const peopleW = draft.occupancy * 110
  const totalLoadW = Math.max(0, envelopeW + solarW + peopleW + draft.heatGainW)

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Slider
          label="Room temperature"
          value={roomDraft ?? device.state.roomTempC}
          min={16}
          max={40}
          step={0.5}
          unit="°C"
          hint="Starting temperature of the air mass"
          disabled={disabled}
          onChange={(value) => setRoomDraft(value)}
          onCommit={(value) => commit({ roomTempC: value })}
        />
        <Slider
          label="Outside temperature"
          value={draft.outsideTempC}
          min={14}
          max={48}
          step={0.5}
          unit="°C"
          hint="Drives conductive heat through the envelope"
          disabled={disabled}
          onChange={(value) => commit({ outsideTempC: value })}
        />
        <Slider
          label="Relative humidity"
          value={draft.humidityPct}
          min={20}
          max={90}
          step={1}
          unit="%"
          disabled={disabled}
          onChange={(value) => commit({ humidityPct: value })}
        />
        <Slider
          label="Floor area"
          value={draft.areaM2}
          min={8}
          max={90}
          step={1}
          unit="m²"
          hint="Larger rooms hold more thermal mass"
          disabled={disabled}
          onChange={(value) => commit({ areaM2: value })}
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-semibold tracking-[0.14em] text-muted uppercase">Insulation</p>
          <span className="text-[10px] text-muted">U = {uValue} W/m²K</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {INSULATION_LIST.map((level) => {
            const Icon = level.icon
            const active = level.value === draft.insulation
            return (
              <button
                key={level.value}
                type="button"
                disabled={disabled}
                onClick={() => commit({ insulation: level.value })}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-lg border px-2.5 py-2 text-left transition disabled:opacity-40',
                  active
                    ? 'border-accent/40 bg-accent-soft'
                    : 'border-line bg-card-2 hover:border-line-strong',
                )}
              >
                <span className={cn('flex items-center gap-1.5 text-[10.5px] font-semibold', active ? 'text-accent' : 'text-fg-soft')}>
                  <Icon className="size-3" /> {level.label}
                </span>
                <span className="text-[9px] leading-3 text-muted">{level.description}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Slider
          label="Window exposure"
          value={draft.windowExposure}
          min={0}
          max={100}
          step={5}
          unit="%"
          disabled={disabled}
          onChange={(value) => commit({ windowExposure: value })}
        />
        <Slider
          label="Occupants"
          value={draft.occupancy}
          min={0}
          max={8}
          step={1}
          unit="people"
          disabled={disabled}
          onChange={(value) => commit({ occupancy: value })}
        />
        <div className="sm:col-span-2">
          <Slider
            label="Additional internal heat gain"
            value={draft.heatGainW}
            min={0}
            max={1500}
            step={25}
            unit="W"
            disabled={disabled}
            onChange={(value) => commit({ heatGainW: value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-lg border border-line bg-card-2/60 p-3 sm:grid-cols-4">
        <LoadStat icon={<Sun className="size-3" />} label="Solar" value={`${Math.round(solarW)} W`} />
        <LoadStat icon={<Users className="size-3" />} label="People" value={`${peopleW} W`} />
        <LoadStat icon={<Building2 className="size-3" />} label="Envelope" value={`${Math.round(envelopeW)} W`} />
        <LoadStat
          icon={<Wind className="size-3" />}
          label="Total load"
          value={`${formatNumber(Math.round(totalLoadW))} W`}
          accent
        />
      </div>

      <p className="flex items-center gap-1.5 text-[10px] text-muted">
        <Leaf className="size-3 text-success" />
        Envelope: {clamp(Math.round((4 * Math.sqrt(draft.areaM2) * 2.7) ), 0, 999)} m² surface · changes apply live at the next physics step.
      </p>
    </div>
  )
}

function LoadStat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div>
      <p className="flex items-center gap-1 text-[9px] font-medium tracking-wide text-muted uppercase">
        {icon}
        {label}
      </p>
      <p className={cn('tnum mt-0.5 text-[11.5px] font-semibold', accent ? 'text-accent' : 'text-fg-soft')}>
        {value}
      </p>
    </div>
  )
}
