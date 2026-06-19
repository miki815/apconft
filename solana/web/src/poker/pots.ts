import type { TableState } from './ws'

export interface PotSlice {
  amount: number
  eligible: string[]
}

export interface PlayerSlice {
  id: string
  seat: number
  status: string
  betThisHand: number
}

export interface DisplayPot {
  key: string
  label: string
  amount: number
  seatLabels: string[]
  isEligibleForMe: boolean
}

/**
 * Display-safe port of poker/src/pot.ts buildPots — keep in sync manually.
 */
export function buildPots(
  contributions: { playerId: string; amount: number }[],
  folded: Set<string>,
): PotSlice[] {
  const active = contributions.filter((c) => c.amount > 0)
  if (active.length === 0) return []

  const levels = [...new Set(active.map((c) => c.amount))].sort((a, b) => a - b)
  const pots: PotSlice[] = []
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

export function formatSeatLabel(seat: number): string {
  return `Mesto ${seat + 1}`
}

function potLabel(index: number): string {
  return index === 0 ? 'Glavni pot' : `Side pot ${index}`
}

function eligibleToSeatLabels(
  eligible: string[],
  players: PlayerSlice[],
): string[] {
  const byId = new Map(players.map((p) => [p.id, p]))
  const seats: number[] = []
  for (const id of eligible) {
    const p = byId.get(id)
    if (!p || p.status === 'folded') continue
    seats.push(p.seat)
  }
  return [...new Set(seats)]
    .sort((a, b) => a - b)
    .map(formatSeatLabel)
}

function buildPotsFromPlayers(players: PlayerSlice[]): PotSlice[] {
  const contributions = players
    .filter((p) => p.betThisHand > 0)
    .map((p) => ({ playerId: p.id, amount: p.betThisHand }))
  const folded = new Set(
    players.filter((p) => p.status === 'folded').map((p) => p.id),
  )
  return buildPots(contributions, folded)
}

export function isPotBreakdownStable(
  state: TableState,
  handInProgress: boolean,
): boolean {
  if (state.handComplete) return true
  return (
    handInProgress &&
    !state.handComplete &&
    state.actionSeat === null &&
    state.players.length > 0 &&
    state.bettingRound !== 'showdown'
  )
}

export function computeDisplayPots(
  state: TableState,
  myPlayerId: string | null,
  handInProgress: boolean,
): { total: number; showBreakdown: boolean; pots: DisplayPot[] } {
  const total = state.players.reduce((n, p) => n + p.betThisHand, 0)
  const stable = isPotBreakdownStable(state, handInProgress)

  const rawPots: PotSlice[] =
    state.handComplete && state.pots.length > 0
      ? state.pots
      : stable
        ? buildPotsFromPlayers(state.players)
        : []

  const showBreakdown = stable && rawPots.length >= 2

  const pots: DisplayPot[] = rawPots.map((pot, index) => ({
    key: `pot-${index}-${pot.amount}`,
    label: potLabel(index),
    amount: pot.amount,
    seatLabels: eligibleToSeatLabels(pot.eligible, state.players),
    isEligibleForMe:
      myPlayerId !== null && pot.eligible.includes(myPlayerId),
  }))

  return { total, showBreakdown, pots }
}
