// Derivacije za raise slider iz trenutnog server stanja stola.
import type { PokerTableView } from './ws'
import type { RaiseBounds } from './types'

// Računa min/max raise iz minRaiseTo, currentBet i hero stack-a.
export function computeRaiseBounds(
  table: PokerTableView | null,
  mySeat: number | null | undefined,
): RaiseBounds | null {
  if (!table?.you.canAct || mySeat === null) return null
  const me = table.state.players.find((p) => p.seat === mySeat)
  if (!me) return null
  const min = table.state.minRaiseTo
  const max = me.betThisRound + me.stack
  if (max <= table.state.currentBet) return null
  return {
    min: Math.min(min, max),
    max,
    step: Math.max(1, table.bigBlind),
    isBet: table.state.currentBet === 0,
  }
}
