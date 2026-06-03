import type { Pot } from './types.js'

export interface PotContribution {
  playerId: string
  amount: number
}

/**
 * Build main + side pots from total per-player contributions this hand.
 * Players who folded are excluded from eligibility but their chips stay in the pot.
 */
export function buildPots(
  contributions: PotContribution[],
  folded: Set<string>,
): Pot[] {
  const active = contributions.filter((c) => c.amount > 0)
  if (active.length === 0) return []

  const levels = [...new Set(active.map((c) => c.amount))].sort((a, b) => a - b)
  const pots: Pot[] = []
  let prev = 0

  for (const level of levels) {
    const layer = active.filter((c) => c.amount >= level)
    const count = layer.length
    const slice = (level - prev) * count
    if (slice <= 0) continue

    const eligible = layer
      .map((c) => c.playerId)
      .filter((id) => !folded.has(id))

    if (eligible.length > 0) {
      pots.push({ amount: slice, eligible })
    }
    prev = level
  }

  return pots
}

/** Split pot amount among winners (integer chips; remainder to first winner). */
export function splitPot(
  amount: number,
  winnerIds: string[],
): { playerId: string; amount: number }[] {
  if (winnerIds.length === 0) return []
  const share = Math.floor(amount / winnerIds.length)
  let remainder = amount - share * winnerIds.length
  return winnerIds.map((playerId) => {
    const extra = remainder > 0 ? 1 : 0
    remainder -= extra
    return { playerId, amount: share + extra }
  })
}
