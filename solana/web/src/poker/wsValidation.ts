// Runtime provere server polja pre countdown prikaza i clock sync-a.
import type { ServerClockAnchor } from './wsTypes'

export function isValidServerNow(v: unknown): v is number {
  return (
    typeof v === 'number' &&
    Number.isFinite(v) &&
    Number.isSafeInteger(v) &&
    v > 0
  )
}

export function isValidShowdownEndsAt(v: unknown): v is number {
  return (
    typeof v === 'number' &&
    Number.isFinite(v) &&
    Number.isSafeInteger(v) &&
    v > 0
  )
}

export function isValidResultDurationMs(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0
}

export function isValidClockAnchor(
  a: ServerClockAnchor | null | undefined,
): boolean {
  if (a == null || typeof a !== 'object') return false
  return (
    isValidServerNow(a.serverNow) &&
    typeof a.receivedAtPerformanceNow === 'number' &&
    Number.isFinite(a.receivedAtPerformanceNow) &&
    a.receivedAtPerformanceNow >= 0
  )
}
