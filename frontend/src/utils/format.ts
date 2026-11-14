import type { AppSettings } from '@/types'

/** Tiny class-merge helper (no runtime dependency needed). */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}

const CURRENCY_SYMBOLS: Record<AppSettings['currency'], string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  BRL: 'R$',
}

export function currencySymbol(currency: AppSettings['currency']): string {
  return CURRENCY_SYMBOLS[currency] ?? '$'
}

export function formatMoney(value: number, currency: AppSettings['currency']): string {
  const digits = Math.abs(value) >= 100 ? 0 : 2
  return `${currencySymbol(currency)}${value.toFixed(digits)}`
}

export function formatNumber(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '—'
  return value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/** Temperature display honours the user's celsius/fahrenheit preference. */
export function formatTemp(celsius: number, unit: AppSettings['temperatureUnit'] = 'celsius'): string {
  if (!Number.isFinite(celsius)) return '—'
  const value = unit === 'fahrenheit' ? celsius * 1.8 + 32 : celsius
  return `${value.toFixed(1)}°`
}

export function tempUnitLabel(unit: AppSettings['temperatureUnit'] = 'celsius'): string {
  return unit === 'fahrenheit' ? '°F' : '°C'
}

export function formatPower(watts: number): { value: string; unit: string } {
  if (watts >= 1000) return { value: (watts / 1000).toFixed(2), unit: 'kW' }
  return { value: Math.round(watts).toString(), unit: 'W' }
}

export function formatEnergy(kwh: number): { value: string; unit: string } {
  if (kwh < 1) return { value: (kwh * 1000).toFixed(0), unit: 'Wh' }
  return { value: kwh.toFixed(2), unit: 'kWh' }
}

export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest === 0 ? `${h}h` : `${h}h ${rest}m`
}

export function formatClock(iso: string | number | Date): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function formatTimeWithSeconds(iso: string | number | Date): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function formatDate(iso: string | number | Date, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleDateString('en-US', opts ?? { month: 'short', day: 'numeric' })
}

export function formatLongDate(date = new Date()): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatRelative(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime())
  const sec = Math.floor(diff / 1000)
  if (sec < 45) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(iso)
}

export function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}

export function pct(part: number, whole: number): number {
  if (!whole) return 0
  return Math.round((part / whole) * 100)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function round(value: number, digits = 1): number {
  const f = 10 ** digits
  return Math.round(value * f) / f
}

export function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n')
}

export function downloadCsv(filename: string, rows: Array<Record<string, unknown>>): void {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
