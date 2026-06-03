export type Suit = 'c' | 'd' | 'h' | 's'

/** 2–14 where ace is high (14); wheel straight uses ace as 1 internally */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14

export interface Card {
  rank: Rank
  suit: Suit
}

export type BettingRound = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'

export type PlayerStatus = 'waiting' | 'active' | 'folded' | 'all-in' | 'sitting-out'

export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all-in'

export type PlayerAction =
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call' }
  /** Total chips committed this betting round (must exceed current bet). */
  | { type: 'bet'; total: number }
  | { type: 'raise'; total: number }
  | { type: 'all-in' }

export interface TableConfig {
  /** Seat index → player id */
  players: { id: string; seat: number; stack: number }[]
  smallBlind: number
  bigBlind: number
  /** Seat index of dealer/button before this hand (optional; default 0). */
  buttonSeat?: number
  /** Inject for tests; defaults to crypto RNG. */
  shuffle?: (cards: Card[]) => Card[]
}

export interface Pot {
  amount: number
  /** Player ids eligible for this pot */
  eligible: string[]
}

export interface PlayerState {
  id: string
  seat: number
  stack: number
  status: PlayerStatus
  /** Chips put in during the current betting round */
  betThisRound: number
  /** Chips put in during the entire hand (for side pots) */
  betThisHand: number
  holeCards: Card[] | null
  /** Label of this player's last action in the current betting round (e.g. "Call 10"). */
  roundAction: string | null
}

export interface TableState {
  handNumber: number
  buttonSeat: number
  smallBlindSeat: number
  bigBlindSeat: number
  bettingRound: BettingRound
  board: Card[]
  pots: Pot[]
  players: PlayerState[]
  /** Total chips all players must match this round to stay in */
  currentBet: number
  /** Minimum raise *to* total for this round */
  minRaiseTo: number
  /** Seat whose action is required; null between streets */
  actionSeat: number | null
  /** Last aggressor seat (for showdown order); null if no bet */
  lastAggressorSeat: number | null
  /** Hand over — winners assigned, board may be complete */
  handComplete: boolean
  winners: { playerId: string; amount: number; potIndex: number }[]
}

export interface ActionResult {
  ok: boolean
  error?: string
  state: TableState
}
