// Priprema server winner redove za prikaz u winner banneru.
import type { WinnerResult } from './ws'
import type { WinnerGroup } from './types'

// Grupiše payout po igraču i sortira pot-ove pre rendera bannera.
export function groupWinners(winners: WinnerResult[]): WinnerGroup[] {
  const byPlayer = new Map<string, WinnerGroup>()
  for (const winner of winners) {
    const group =
      byPlayer.get(winner.playerId) ??
      { playerId: winner.playerId, total: 0, wins: [] }
    group.total += winner.amount
    group.wins.push(winner)
    byPlayer.set(winner.playerId, group)
  }
  return [...byPlayer.values()].map((group) => ({
    ...group,
    wins: [...group.wins].sort((a, b) => a.potIndex - b.potIndex),
  }))
}
