import { useState } from 'react'
import {
  Building2,
  CircleDollarSign,
  Database,
  Gauge,
  LogOut,
  Monitor,
  Moon,
  Palette,
  RotateCcw,
  Save,
  Sun,
  Thermometer,
  UserRound,
} from 'lucide-react'
import type { AppSettings } from '@/types'
import { useAuth } from '@/contexts/AuthProvider'
import { useSettings } from '@/contexts/SettingsProvider'
import { useToast } from '@/contexts/ToastProvider'
import { SIM_SPEEDS, TIME_RANGES } from '@/utils/constants'
import { cn, formatDate, formatLongDate } from '@/utils/format'
import { PageHeader } from '@/components/common/PageHeader'
import { Card, CardHeader } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { Badge } from '@/components/common/Badge'
import { Input } from '@/components/common/Input'
import { Select, SegmentedControl } from '@/components/common/Select'
import { Slider, Switch } from '@/components/common/Slider'
import { Modal } from '@/components/common/Modal'

export function SettingsPage() {
  const { settings, update, reset, toggleTheme } = useSettings()
  const { user, updateProfile, logout } = useAuth()
  const { toast } = useToast()

  const [draft, setDraft] = useState<AppSettings>(settings)
  const [profile, setProfile] = useState({ name: user?.name ?? '', email: user?.email ?? '' })
  const [resetOpen, setResetOpen] = useState(false)

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings)
  const patch = (next: Partial<AppSettings>) => setDraft((prev) => ({ ...prev, ...next }))

  const save = () => {
    update(draft)
    toast({ title: 'Preferences saved', description: 'Your workspace settings have been applied.', variant: 'success' })
  }

  const saveProfile = () => {
    if (!profile.name.trim() || !profile.email.trim()) {
      toast({ title: 'Name and email are required', variant: 'error' })
      return
    }
    updateProfile({ name: profile.name.trim(), email: profile.email.trim() })
    toast({ title: 'Profile updated', variant: 'success' })
  }

  const confirmReset = () => {
    reset()
    setDraft({ ...settings })
    setResetOpen(false)
    toast({ title: 'Settings restored', description: 'All preferences are back to their defaults.', variant: 'info' })
  }

  return (
    <div className="space-y-5 pb-16">
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="Theme, units, tariffs and the defaults every new simulation starts from."
        actions={
          <>
            <Button variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={() => setResetOpen(true)}>
              Reset
            </Button>
            <Button variant="primary" icon={<Save className="size-3.5" />} onClick={save} disabled={!dirty}>
              {dirty ? 'Save changes' : 'Saved'}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Appearance */}
        <Card>
          <CardHeader title="Appearance" description="How CoolSense looks on this device" icon={<Palette className="size-4" />} />
          <div className="space-y-4 p-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <ThemeTile
                label="Dark"
                hint="Low glare, ideal at night"
                icon={<Moon className="size-4" />}
                active={draft.theme === 'dark'}
                onClick={() => patch({ theme: 'dark' })}
              />
              <ThemeTile
                label="Light"
                hint="High contrast, daylight"
                icon={<Sun className="size-4" />}
                active={draft.theme === 'light'}
                onClick={() => patch({ theme: 'light' })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-line bg-card-2 px-3 py-2.5">
              <div>
                <p className="text-[11.5px] font-medium text-fg">Preview this theme now</p>
                <p className="text-[10.5px] text-muted">Applies immediately without saving</p>
              </div>
              <Button size="xs" variant="outline" icon={<Monitor className="size-3" />} onClick={toggleTheme}>
                Toggle
              </Button>
            </div>
            <div>
              <p className="mb-1.5 text-[11.5px] font-medium text-fg-soft">Default time range</p>
              <SegmentedControl
                value={draft.defaultTimeRange}
                onChange={(value) => patch({ defaultTimeRange: value })}
                options={TIME_RANGES.map((range) => ({ value: range.value, label: range.label }))}
                ariaLabel="Default time range"
              />
            </div>
          </div>
        </Card>

        {/* Units */}
        <Card>
          <CardHeader title="Units & tariff" description="Numbers shown across dashboards and reports" icon={<Gauge className="size-4" />} />
          <div className="space-y-4 p-4">
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-medium text-fg-soft">
                <Thermometer className="size-3.5" /> Temperature unit
              </p>
              <SegmentedControl
                value={draft.temperatureUnit}
                onChange={(value) => patch({ temperatureUnit: value })}
                options={[
                  { value: 'celsius', label: 'Celsius °C' },
                  { value: 'fahrenheit', label: 'Fahrenheit °F' },
                ]}
                ariaLabel="Temperature unit"
              />
            </div>
            <div>
              <p className="mb-1.5 text-[11.5px] font-medium text-fg-soft">Energy unit</p>
              <SegmentedControl
                value={draft.energyUnit}
                onChange={(value) => patch({ energyUnit: value })}
                options={[
                  { value: 'kwh', label: 'kWh' },
                  { value: 'wh', label: 'Wh' },
                ]}
                ariaLabel="Energy unit"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-medium text-fg-soft">
                  <CircleDollarSign className="size-3.5" /> Currency
                </p>
                <Select
                  value={draft.currency}
                  onChange={(event) => patch({ currency: event.target.value as AppSettings['currency'] })}
                  options={[
                    { value: 'USD', label: 'USD — US dollar' },
                    { value: 'EUR', label: 'EUR — Euro' },
                    { value: 'GBP', label: 'GBP — Pound sterling' },
                    { value: 'INR', label: 'INR — Indian rupee' },
                    { value: 'BRL', label: 'BRL — Brazilian real' },
                  ]}
                  aria-label="Currency"
                />
              </div>
              <div>
                <p className="mb-1.5 text-[11.5px] font-medium text-fg-soft">Tariff per kWh</p>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={draft.pricePerKwh}
                  onChange={(event) => patch({ pricePerKwh: Number(event.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-card-2 px-3 py-2.5">
              <Switch
                checked={draft.includeStandbyDraw}
                onChange={(checked) => patch({ includeStandbyDraw: checked })}
                size="sm"
                label="Include standby draw"
                description="Add ~4 W idle consumption to energy totals"
              />
              <Badge tone={draft.includeStandbyDraw ? 'success' : 'neutral'}>
                {draft.includeStandbyDraw ? 'ON' : 'OFF'}
              </Badge>
            </div>
          </div>
        </Card>

        {/* Simulation defaults */}
        <Card className="xl:col-span-2">
          <CardHeader
            title="Simulation defaults"
            description="Starting conditions for new simulations and recovery after a reset"
            icon={<Building2 className="size-4" />}
            action={<Badge tone="accent">{SIM_SPEEDS.find((s) => s.value === draft.simulationSpeed)?.label ?? `${draft.simulationSpeed}×`} speed</Badge>}
          />
          <div className="grid gap-5 p-4 md:grid-cols-2">
            <div className="space-y-4">
              <Slider
                label="Default room temperature"
                value={draft.defaultRoomTempC}
                min={18}
                max={34}
                step={0.5}
                unit="°C"
                onChange={(value) => patch({ defaultRoomTempC: value })}
              />
              <Slider
                label="Default target temperature"
                value={draft.defaultTargetTempC}
                min={16}
                max={28}
                step={0.5}
                unit="°C"
                onChange={(value) => patch({ defaultTargetTempC: value })}
              />
            </div>
            <div className="space-y-4">
              <Slider
                label="Default outside temperature"
                value={draft.defaultOutsideTempC}
                min={15}
                max={46}
                step={0.5}
                unit="°C"
                onChange={(value) => patch({ defaultOutsideTempC: value })}
              />
              <Slider
                label="Default humidity"
                value={draft.defaultHumidityPct}
                min={20}
                max={90}
                step={1}
                unit="%"
                onChange={(value) => patch({ defaultHumidityPct: value })}
              />
            </div>
            <div className="md:col-span-2">
              <p className="mb-1.5 text-[11.5px] font-medium text-fg-soft">Simulation speed</p>
              <SegmentedControl
                value={draft.simulationSpeed}
                onChange={(value) => patch({ simulationSpeed: value })}
                options={SIM_SPEEDS.map((speed) => ({ value: speed.value, label: speed.label }))}
                ariaLabel="Simulation speed"
              />
            </div>
          </div>
        </Card>

        {/* Account */}
        <Card>
          <CardHeader title="Account" description="Profile details for this workspace" icon={<UserRound className="size-4" />} />
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-3 rounded-xl border border-line bg-card-2 p-3">
              <span className="grid size-10 place-items-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent-ink">
                {(user?.name ?? 'U').slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-semibold text-fg">{user?.name ?? 'Guest'}</p>
                <p className="truncate text-[11px] text-muted">{user?.email ?? 'Not signed in'}</p>
              </div>
              <Badge tone="violet" className="ml-auto capitalize">
                {user?.role ?? 'viewer'}
              </Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-[11.5px] font-medium text-fg-soft">Display name</p>
                <Input value={profile.name} onChange={(event) => setProfile((p) => ({ ...p, name: event.target.value }))} />
              </div>
              <div>
                <p className="mb-1.5 text-[11.5px] font-medium text-fg-soft">Email</p>
                <Input
                  type="email"
                  value={profile.email}
                  onChange={(event) => setProfile((p) => ({ ...p, email: event.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <p className="text-[10.5px] text-muted">
                Member since {user?.createdAt ? formatDate(user.createdAt, { month: 'long', year: 'numeric' }) : '—'}
              </p>
              <Button size="sm" variant="secondary" onClick={saveProfile}>
                Update profile
              </Button>
            </div>
          </div>
        </Card>

        {/* Data */}
        <Card>
          <CardHeader title="Data & session" description="Local storage, mock engine and sign-out" icon={<Database className="size-4" />} />
          <div className="space-y-3 p-4">
            <div className="flex items-center justify-between rounded-lg border border-line bg-card-2 px-3 py-2.5">
              <div>
                <p className="text-[11.5px] font-medium text-fg">Telemetry source</p>
                <p className="text-[10.5px] text-muted">Mock engine drives this build</p>
              </div>
              <Badge tone="warning" dot>
                SIMULATED
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-line bg-card-2 px-3 py-2.5">
              <div>
                <p className="text-[11.5px] font-medium text-fg">Today</p>
                <p className="text-[10.5px] text-muted">{formatLongDate()}</p>
              </div>
              <Badge tone="neutral">local time</Badge>
            </div>
            <Button
              variant="danger"
              icon={<LogOut className="size-3.5" />}
              className="w-full"
              onClick={() => void logout()}
            >
              Sign out of this workspace
            </Button>
          </div>
        </Card>
      </div>

      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="Reset all settings?" size="sm">
        <p className="text-[12px] leading-6 text-muted">
          Theme, units, tariff and simulation defaults will return to their factory values. Your devices and
          telemetry history are not affected.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setResetOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={confirmReset}>
            Reset settings
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function ThemeTile({
  label,
  hint,
  icon,
  active,
  onClick,
}: {
  label: string
  hint: string
  icon: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-3 rounded-xl border p-3 text-left transition-all duration-150',
        active
          ? 'border-accent/50 bg-accent-soft shadow-[0_0_0_1px_var(--accent-soft)]'
          : 'border-line bg-card-2 hover:border-line-strong',
      )}
    >
      <span
        className={cn(
          'grid size-8 place-items-center rounded-lg border',
          active ? 'border-accent/40 bg-card text-accent' : 'border-line bg-card text-muted',
        )}
      >
        {icon}
      </span>
      <span>
        <span className="block text-[12px] font-semibold text-fg">{label}</span>
        <span className="block text-[10.5px] text-muted">{hint}</span>
      </span>
    </button>
  )
}
