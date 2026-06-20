import type { PokerTableView } from './ws'

export const SHOWDOWN_MS = 5000

/** Result display is the shared post-hand phase for showdown and fold wins. */
export function isResultDisplayActive(table: PokerTableView | null): boolean {
  return table?.resultKind !== null && table?.state.handComplete === true
}

/** Detect multi-player showdown from server flags or revealed hole cards. */
export function isShowdownPhase(table: PokerTableView | null): boolean {
  if (!table) return false
  if (table.showdownActive) return true

  const s = table.state
  if (!s.handComplete || s.board.length < 5) return false

  const revealed = s.players.filter(
    (p) => p.status !== 'folded' && p.holeCards && p.holeCards.length >= 2,
  )
  return revealed.length >= 2
}
