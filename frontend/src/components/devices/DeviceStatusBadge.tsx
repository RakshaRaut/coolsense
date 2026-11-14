import type { AcDevice } from '@/types'
import { Badge } from '@/components/common/Badge'

export function DeviceStatusBadge({ device }: { device: AcDevice }) {
  if (!device.state.online) return <Badge tone="danger" dot>Offline</Badge>
  return device.state.power ? (
    <Badge tone="success" dot>Running</Badge>
  ) : (
    <Badge tone="neutral" dot>Standby</Badge>
  )
}

export function CompressorBadge({ device }: { device: AcDevice }) {
  const { compressorOn, compressorModulation, online } = device.state
  if (!online) return <Badge tone="neutral">—</Badge>
  if (!compressorOn) return <Badge tone="neutral">Idle</Badge>
  if (device.inverter) {
    return <Badge tone="accent">Mod {compressorModulation}%</Badge>
  }
  return <Badge tone="warning">Full load</Badge>
}
