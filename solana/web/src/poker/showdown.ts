import type { PokerTableView } from './ws'
import {
  isValidClockAnchor,
  isValidResultDurationMs,
  isValidShowdownEndsAt,
} from './ws'

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

export function computeResultCountdownState(
  table: PokerTableView | null,
  resultPhase: boolean,
) {
  const resultEndsAt = table?.showdownEndsAt ?? null
  const resultDurationMs = table?.resultDurationMs ?? null
  const hasDeadlineFields =
    isValidShowdownEndsAt(resultEndsAt) &&
    isValidResultDurationMs(resultDurationMs)
  const countdownReady =
    resultPhase &&
    hasDeadlineFields &&
    isValidClockAnchor(table?.clockAnchor)
  const showDeadlineFallback = resultPhase && !hasDeadlineFields
  return {
    resultEndsAt,
    resultDurationMs,
    countdownReady,
    showDeadlineFallback,
  }
}
