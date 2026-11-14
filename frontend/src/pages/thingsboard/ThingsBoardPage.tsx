import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Check,
  CloudUpload,
  Copy,
  Database,
  Droplets,
  KeyRound,
  Link2,
  Radio,
  RefreshCw,
  Settings2,
  Thermometer,
  Zap,
} from 'lucide-react'
import { getThingsBoardStatus, syncThingsBoard } from '@/api/thingsboard.api'
import { useToast } from '@/contexts/ToastProvider'
import { cn, formatRelative, formatTimeWithSeconds } from '@/utils/format'
import { PageHeader } from '@/components/common/PageHeader'
import { Card, CardHeader, SectionHeading } from '@/components/common/Card'
import { Button } from '@/components/common/Button'
import { Badge, StatusDot } from '@/components/common/Badge'
import { ErrorState, SkeletonCard } from '@/components/common/States'

export function ThingsBoardPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [syncing, setSyncing] = useState(false)
  const [copied, setCopied] = useState(false)

  const statusQuery = useQuery({
    queryKey: ['thingsboard-status'],
    queryFn: getThingsBoardStatus,
    refetchInterval: 30_000,
  })

  const status = statusQuery.data

  const payload = useMemo(() => {
    if (!status?.telemetry) return null
    return JSON.stringify(status.telemetry, null, 2)
  }, [status])

  const sync = async () => {
    setSyncing(true)
    try {
      const next = await syncThingsBoard()
      queryClient.setQueryData(['thingsboard-status'], next)
      queryClient.invalidateQueries({ queryKey: ['thingsboard-status'] })
      toast({
        title: next.connected ? 'Telemetry synced' : 'Sync finished with issues',
        description: next.connected
          ? 'Latest state was pushed to ThingsBoard.'
          : 'Check the error log below for details.',
        variant: next.connected ? 'success' : 'error',
      })
    } catch (error) {
      toast({
        title: 'Sync failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'error',
      })
    } finally {
      setSyncing(false)
    }
  }

  const copyPayload = async () => {
    if (!payload) return
    try {
      await navigator.clipboard.writeText(payload)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      toast({ title: 'Clipboard unavailable', variant: 'error' })
    }
  }

  const steps = [
    { label: 'Register device', done: status?.registered ?? false },
    { label: 'Authenticate with access token', done: (status?.deviceKeyMasked ?? '—') !== '—' },
    { label: 'Establish MQTT / HTTP link', done: status?.connected ?? false },
    { label: 'Push first telemetry sample', done: status?.synchronized ?? false },
  ]
  const completed = steps.filter((step) => step.done).length

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Integration"
        title="ThingsBoard"
        description="Stream live AC telemetry into your ThingsBoard instance and keep the device shadow in step."
        actions={
          <>
            <Button
              variant="ghost"
              icon={<RefreshCw className={cn('size-3.5', queryClient.isFetching() > 0 && 'animate-spin')} />}
              onClick={() => void statusQuery.refetch()}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              icon={<CloudUpload className="size-4" />}
              loading={syncing}
              onClick={() => void sync()}
            >
              Sync telemetry
            </Button>
          </>
        }
      />

      {statusQuery.error ? (
        <ErrorState
          message={statusQuery.error instanceof Error ? statusQuery.error.message : 'Unable to reach integration'}
          onRetry={() => void statusQuery.refetch()}
        />
      ) : null}

      {!status ? (
        <div className="grid gap-3 md:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <>
          {/* Connection hero */}
          <Card className="relative overflow-hidden">
            <div
              className={cn(
                'pointer-events-none absolute inset-0',
                status.connected
                  ? 'bg-[radial-gradient(ellipse_60%_140%_at_0%_0%,var(--success-soft),transparent_60%)]'
                  : 'bg-[radial-gradient(ellipse_60%_140%_at_0%_0%,var(--danger-soft),transparent_60%)]',
              )}
            />
            <div className="relative flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="flex items-start gap-3">
                <span className="grid size-11 place-items-center rounded-xl border border-line bg-card">
                  <Link2 className={cn('size-5', status.connected ? 'text-success' : 'text-danger')} />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[15px] font-semibold tracking-tight text-fg">
                      {status.connected ? 'Gateway online' : 'Gateway offline'}
                    </p>
                    <Badge tone={status.connected ? 'success' : 'danger'} dot>
                      {status.connected ? 'CONNECTED' : 'DISCONNECTED'}
                    </Badge>
                  </div>
                  <p className="mt-1 max-w-lg text-[11.5px] leading-5 text-muted">
                    {status.connected
                      ? 'Telemetry is flowing from your AC fleet into ThingsBoard. Device shadow updates on every sync.'
                      : 'The integration cannot reach your ThingsBoard instance. Verify the host, token and network path.'}
                  </p>
                </div>
              </div>
              <div className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-2 text-[10.5px] sm:grid-cols-3">
                <StatusFact label="Device key" value={status.deviceKeyMasked} />
                <StatusFact
                  label="Last sync"
                  value={status.lastSyncAt ? formatRelative(status.lastSyncAt) : 'Never'}
                />
                <StatusFact
                  label="Last telemetry"
                  value={status.lastTelemetryAt ? formatRelative(status.lastTelemetryAt) : 'Never'}
                />
              </div>
            </div>
          </Card>

          <div className="grid gap-3 lg:grid-cols-[1fr_1.15fr]">
            {/* Setup progress */}
            <Card>
              <CardHeader
                title="Provisioning"
                description={`${completed} of ${steps.length} steps complete`}
                icon={<Settings2 className="size-4" />}
                action={<Badge tone={completed === steps.length ? 'success' : 'warning'}>{completed}/{steps.length}</Badge>}
              />
              <div className="p-4">
                <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-card-2">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent to-success transition-all duration-500"
                    style={{ width: `${(completed / steps.length) * 100}%` }}
                  />
                </div>
                <ol className="space-y-1">
                  {steps.map((step, index) => (
                    <li
                      key={step.label}
                      className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-card-2/60"
                    >
                      <span
                        className={cn(
                          'grid size-5 shrink-0 place-items-center rounded-full border text-[9.5px] font-semibold',
                          step.done
                            ? 'border-success/40 bg-success-soft text-success'
                            : 'border-line bg-card-2 text-muted',
                        )}
                      >
                        {step.done ? <Check className="size-3" /> : index + 1}
                      </span>
                      <span className={cn('text-[11.5px]', step.done ? 'text-fg-soft' : 'text-muted')}>
                        {step.label}
                      </span>
                    </li>
                  ))}
                </ol>
                <div className="mt-3 flex items-center justify-between rounded-lg border border-line bg-card-2 px-3 py-2">
                  <span className="flex items-center gap-1.5 text-[10px] text-muted">
                    <KeyRound className="size-3" />
                    Access token
                  </span>
                  <code className="tnum text-[11px] font-semibold text-fg">{status.deviceKeyMasked}</code>
                </div>
              </div>
            </Card>

            {/* Telemetry */}
            <Card>
              <CardHeader
                title="Last telemetry payload"
                description="Exactly what is written to the device attributes"
                icon={<Database className="size-4" />}
                action={
                  <Button
                    size="xs"
                    variant="ghost"
                    icon={copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                    onClick={() => void copyPayload()}
                    disabled={!payload}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                }
              />
              {status.telemetry ? (
                <div className="grid grid-cols-2 divide-x divide-y divide-line border-b border-line sm:grid-cols-4 [&>*]:p-3">
                  <TelemetryCell
                    label="Room"
                    value={`${status.telemetry.roomTempC.toFixed(1)}°C`}
                    icon={<Thermometer className="size-3" />}
                  />
                  <TelemetryCell
                    label="Target"
                    value={`${status.telemetry.targetTempC.toFixed(1)}°C`}
                    icon={<Settings2 className="size-3" />}
                    tone="violet"
                  />
                  <TelemetryCell
                    label="Humidity"
                    value={`${status.telemetry.humidityPct.toFixed(0)}%`}
                    icon={<Droplets className="size-3" />}
                    tone="accent"
                  />
                  <TelemetryCell
                    label="Compressor"
                    value={status.telemetry.compressorState ? 'RUNNING' : 'IDLE'}
                    icon={<Zap className="size-3" />}
                    tone={status.telemetry.compressorState ? 'success' : 'muted'}
                  />
                </div>
              ) : null}
              <div className="p-4">
                {payload ? (
                  <pre className="max-h-[210px] overflow-auto rounded-lg border border-line bg-[var(--code-bg,var(--card-2))] p-3 text-[10.5px] leading-5 text-fg-soft">
                    {payload}
                  </pre>
                ) : (
                  <div className="flex h-[180px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line text-muted">
                    <Radio className="size-5 opacity-60" />
                    <p className="text-[11px]">No telemetry received yet</p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Errors */}
          <div>
            <SectionHeading title="Diagnostics" description="Anything the gateway rejected or could not deliver" />
            <Card className="mt-3">
              <div className="border-b border-line px-4 py-3">
                <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-fg-soft">
                  <AlertTriangle className={cn('size-3.5', status.errors.length ? 'text-warning' : 'text-success')} />
                  {status.errors.length ? `${status.errors.length} reported issue(s)` : 'No errors reported'}
                </p>
                <p className="mt-0.5 text-[10.5px] text-muted">
                  Last successful handshake {status.lastSyncAt ? formatTimeWithSeconds(status.lastSyncAt) : '—'}
                </p>
              </div>
              {status.errors.length ? (
                <ul className="divide-y divide-line">
                  {status.errors.map((error, index) => (
                    <li key={`${error}-${index}`} className="flex items-start gap-2 px-4 py-2.5">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning" />
                      <span className="text-[11px] leading-5 text-fg-soft">{error}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-4 text-[11px] text-muted">
                  The gateway is healthy. Telemetry is being acknowledged by ThingsBoard without rejections.
                </p>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function StatusFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-semibold tracking-[0.1em] text-muted uppercase">{label}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-fg">
        <StatusDot tone="accent" className="scale-75" />
        {value}
      </p>
    </div>
  )
}

function TelemetryCell({
  label,
  value,
  icon,
  tone = 'muted',
}: {
  label: string
  value: string
  icon: React.ReactNode
  tone?: 'muted' | 'accent' | 'violet' | 'success'
}) {
  const tones = {
    muted: 'text-fg',
    accent: 'text-accent',
    violet: 'text-violet',
    success: 'text-success',
  }
  return (
    <div>
      <p className="flex items-center gap-1 text-[9px] font-semibold tracking-[0.1em] text-muted uppercase">
        {icon}
        {label}
      </p>
      <p className={cn('tnum mt-1 text-[13px] font-semibold', tones[tone])}>{value}</p>
    </div>
  )
}
