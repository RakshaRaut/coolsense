import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AirVent,
  ArrowUpDown,
  LayoutGrid,
  List,
  Plus,
  Power,
  Search,
  Snowflake,
  Thermometer,
  Trash2,
} from 'lucide-react'
import type { AcDevice, DeviceType } from '@/types'
import { sendControl } from '@/api/control.api'
import { deleteDevice } from '@/api/devices.api'
import { errorMessage } from '@/api/axios'
import { useLiveData } from '@/contexts/LiveDataProvider'
import { useSettings } from '@/contexts/SettingsProvider'
import { useToast } from '@/contexts/ToastProvider'
import { DEVICE_TYPE_LABEL, FAN_META } from '@/utils/constants'
import { cn, formatEnergy, formatPower, formatTemp } from '@/utils/format'
import { PageHeader } from '@/components/common/PageHeader'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { Badge } from '@/components/common/Badge'
import { Select, SegmentedControl } from '@/components/common/Select'
import { Input, InputGroup } from '@/components/common/Input'
import { ConfirmDialog } from '@/components/common/Modal'
import { EmptyState, ErrorState, SkeletonCard } from '@/components/common/States'
import { DeviceCard } from '@/components/devices/DeviceCard'
import { CompressorBadge, DeviceStatusBadge } from '@/components/devices/DeviceStatusBadge'
import { DeviceForm } from '@/components/devices/DeviceForm'

type StatusFilter = 'all' | 'running' | 'standby' | 'offline'
type CompressorFilter = 'all' | 'inverter' | 'fixed'
type SortKey = 'name' | 'temp' | 'power' | 'energy'

const PAGE_SIZE = 9

export function DevicesPage() {
  const { devices, isLoading, error, refetch, removeDevice } = useLiveData()
  const { settings } = useSettings()
  const { toast } = useToast()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [type, setType] = useState<'all' | DeviceType>('all')
  const [compressor, setCompressor] = useState<CompressorFilter>('all')
  const [sort, setSort] = useState<SortKey>('name')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AcDevice | null>(null)
  const [deleting, setDeleting] = useState<AcDevice | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = devices.filter((device) => {
      const matchesSearch =
        !q ||
        device.name.toLowerCase().includes(q) ||
        device.environment.roomName.toLowerCase().includes(q) ||
        device.modelName.toLowerCase().includes(q) ||
        device.key.toLowerCase().includes(q)
      const matchesStatus =
        status === 'all'
          ? true
          : status === 'running'
            ? device.state.online && device.state.power
            : status === 'standby'
              ? device.state.online && !device.state.power
              : !device.state.online
      const matchesType = type === 'all' || device.type === type
      const matchesCompressor =
        compressor === 'all' ? true : compressor === 'inverter' ? device.inverter : !device.inverter
      return matchesSearch && matchesStatus && matchesType && matchesCompressor
    })

    return rows.sort((a, b) => {
      switch (sort) {
        case 'temp':
          return b.state.roomTempC - a.state.roomTempC
        case 'power':
          return b.state.powerW - a.state.powerW
        case 'energy':
          return b.state.energyKwh - a.state.energyKwh
        default:
          return a.name.localeCompare(b.name)
      }
    })
  }, [devices, search, status, type, compressor, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const togglePower = async (device: AcDevice) => {
    setBusyId(device.id)
    try {
      await sendControl(device.id, { power: !device.state.power })
      toast({
        title: `${device.name} ${device.state.power ? 'turned off' : 'turned on'}`,
        variant: 'success',
      })
    } catch (err) {
      toast({ title: 'Command failed', description: errorMessage(err), variant: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      await deleteDevice(deleting.id)
      removeDevice(deleting.id)
      toast({ title: 'Device deleted', description: `${deleting.name} was removed.`, variant: 'success' })
      setDeleting(null)
    } catch (err) {
      toast({ title: 'Could not delete device', description: errorMessage(err), variant: 'error' })
    } finally {
      setDeleteBusy(false)
    }
  }

  const offlineCount = devices.filter((d) => !d.state.online).length
  const activeCount = devices.filter((d) => d.state.online && d.state.power).length

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Fleet management"
        title="AC Devices"
        description="Register, configure and operate every virtual unit. All devices are software-simulated rooms."
        actions={
          <>
            <SegmentedControl
              value={view}
              onChange={(value) => setView(value as 'grid' | 'list')}
              options={[
                { value: 'grid', label: '', icon: <LayoutGrid className="size-3.5" /> },
                { value: 'list', label: '', icon: <List className="size-3.5" /> },
              ]}
              ariaLabel="View mode"
            />
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setFormOpen(true)}>
              Add device
            </Button>
          </>
        }
      />

      {error ? <ErrorState message={error} onRetry={refetch} /> : null}

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <InputGroup icon={<Search className="size-3.5" />} className="min-w-[200px] flex-1">
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Search by name, room, model or key…"
              className="h-9 pl-9"
              aria-label="Search devices"
            />
          </InputGroup>
          <Select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as StatusFilter)
              setPage(1)
            }}
            className="h-9 w-[132px]"
            aria-label="Filter by status"
            options={[
              { value: 'all', label: 'All status' },
              { value: 'running', label: 'Running' },
              { value: 'standby', label: 'Standby' },
              { value: 'offline', label: 'Offline' },
            ]}
          />
          <Select
            value={type}
            onChange={(event) => {
              setType(event.target.value as 'all' | DeviceType)
              setPage(1)
            }}
            className="h-9 w-[140px]"
            aria-label="Filter by type"
            options={[
              { value: 'all', label: 'All types' },
              ...(Object.keys(DEVICE_TYPE_LABEL) as DeviceType[]).map((value) => ({
                value,
                label: DEVICE_TYPE_LABEL[value],
              })),
            ]}
          />
          <Select
            value={compressor}
            onChange={(event) => {
              setCompressor(event.target.value as CompressorFilter)
              setPage(1)
            }}
            className="h-9 w-[150px]"
            aria-label="Filter by compressor"
            options={[
              { value: 'all', label: 'All compressors' },
              { value: 'inverter', label: 'Inverter' },
              { value: 'fixed', label: 'Fixed speed' },
            ]}
          />
          <Select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className="h-9 w-[150px]"
            aria-label="Sort devices"
            options={[
              { value: 'name', label: 'Sort: Name' },
              { value: 'temp', label: 'Sort: Room temp' },
              { value: 'power', label: 'Sort: Power' },
              { value: 'energy', label: 'Sort: Energy' },
            ]}
          />
          <div className="ml-auto flex items-center gap-2 pr-1 text-[11px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-success" /> {activeCount} active
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-muted" /> {offlineCount} offline
            </span>
            <Badge tone="neutral">{filtered.length} shown</Badge>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} className="h-[240px]" />
          ))}
        </div>
      ) : devices.length === 0 ? (
        <EmptyState
          icon={<AirVent className="size-6" />}
          title="No AC devices yet"
          description="Register your first virtual air conditioner to start simulating room temperature, compressor behaviour and energy use."
          action={
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setFormOpen(true)}>
              Add AC device
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Search className="size-6" />}
          title="No devices match your filters"
          description="Try clearing the search term or switching the status, type and compressor filters."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setSearch('')
                setStatus('all')
                setType('all')
                setCompressor('all')
              }}
            >
              Reset filters
            </Button>
          }
        />
      ) : view === 'grid' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              onEdit={setEditing}
              onDelete={setDeleting}
              onTogglePower={togglePower}
              busy={busyId === device.id}
            />
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[1.6fr_1fr_1fr_0.8fr_0.8fr_0.9fr] gap-3 border-b border-line px-4 py-2.5 text-[9.5px] font-semibold tracking-[0.1em] text-muted uppercase md:grid">
            <span>Device</span>
            <span>Status</span>
            <span>Room / target</span>
            <span>Power</span>
            <span>Energy</span>
            <span className="text-right">Actions</span>
          </div>
          <ul className="divide-y divide-line">
            {visible.map((device) => {
              const power = formatPower(device.state.powerW)
              const energy = formatEnergy(device.state.energyKwh)
              return (
                <li
                  key={device.id}
                  className="grid grid-cols-1 gap-2 px-4 py-3 transition hover:bg-card-2/60 md:grid-cols-[1.6fr_1fr_1fr_0.8fr_0.8fr_0.9fr] md:items-center md:gap-3"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={cn(
                        'grid size-8 shrink-0 place-items-center rounded-lg border',
                        device.state.power && device.state.online
                          ? 'border-accent/25 bg-accent-soft text-accent'
                          : 'border-line bg-card-2 text-muted',
                      )}
                    >
                      <Snowflake className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <Link
                        to={`/devices/${device.id}`}
                        className="block truncate text-[12.5px] font-semibold text-fg hover:text-accent"
                      >
                        {device.name}
                      </Link>
                      <p className="truncate text-[10.5px] text-muted">
                        {device.environment.roomName} · {device.modelName}
                      </p>
                    </div>
                    <Badge tone={device.inverter ? 'violet' : 'neutral'} className="ml-auto md:hidden">
                      {device.inverter ? 'INV' : 'FIXED'}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <DeviceStatusBadge device={device} />
                    <CompressorBadge device={device} />
                  </div>
                  <div className="tnum flex items-center gap-1.5 text-[12px]">
                    <Thermometer className="size-3 text-muted" />
                    <span className="font-semibold text-fg">
                      {formatTemp(device.state.roomTempC, settings.temperatureUnit)}
                    </span>
                    <span className="text-muted">/ {formatTemp(device.state.targetTempC, settings.temperatureUnit)}</span>
                  </div>
                  <span className="tnum text-[12px] font-medium text-fg-soft">
                    {power.value} {power.unit}
                  </span>
                  <span className="tnum text-[12px] font-medium text-fg-soft">
                    {energy.value} {energy.unit}
                  </span>
                  <div className="flex items-center gap-1 md:justify-end">
                    <button
                      type="button"
                      onClick={() => togglePower(device)}
                      disabled={!device.state.online || busyId === device.id}
                      className="rounded-md p-1.5 text-muted transition hover:bg-card-2 hover:text-success disabled:opacity-40"
                      aria-label={device.state.power ? 'Turn off' : 'Turn on'}
                    >
                      <Power className="size-3.5" />
                    </button>
                    <Link
                      to={`/control?device=${device.id}`}
                      className="rounded-md px-2 py-1 text-[10.5px] font-medium text-muted transition hover:bg-card-2 hover:text-fg"
                    >
                      Control
                    </Link>
                    <button
                      type="button"
                      onClick={() => setDeleting(device)}
                      className="rounded-md p-1.5 text-muted transition hover:bg-danger-soft hover:text-danger"
                      aria-label="Delete device"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {filtered.length > 0 ? (
        <div className="flex items-center justify-between px-1 text-[11px] text-muted">
          <span className="flex items-center gap-1.5">
            <ArrowUpDown className="size-3" />
            Showing {visible.length} of {filtered.length} devices
            {view === 'grid' ? ' · fan speed shown on cards' : ''}
          </span>
          {totalPages > 1 ? (
            <div className="flex items-center gap-1">
              <Button size="xs" variant="ghost" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                Prev
              </Button>
              <span className="tnum px-2 font-medium text-fg-soft">
                {currentPage} / {totalPages}
              </span>
              <Button
                size="xs"
                variant="ghost"
                disabled={currentPage === totalPages}
                onClick={() => setPage(currentPage + 1)}
              >
                Next
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="text-[10px] text-muted">
        Fan speeds: {Object.values(FAN_META).map((f) => f.label).join(' · ')} — telemetry updates in
        real time from the simulation engine.
      </p>

      <DeviceForm open={formOpen} onClose={() => setFormOpen(false)} />
      <DeviceForm open={Boolean(editing)} device={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.name ?? 'device'}?`}
        description="This removes the virtual unit, its room configuration and its telemetry history. This action cannot be undone."
        confirmLabel="Delete device"
        loading={deleteBusy}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}
