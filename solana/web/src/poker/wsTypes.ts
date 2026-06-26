// Tipovi poker WebSocket poruka i PokerTableView stanja koje UI koristi.
export type Suit = 'c' | 'd' | 'h' | 's'
export type Rank = number
export interface Card {
  rank: Rank
  suit: Suit
}

export type PlayerAction =
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call' }
  | { type: 'bet'; total: number }
  | { type: 'raise'; total: number }
  | { type: 'all-in' }

export interface WinnerHandRank {
  category: number
  name: string
}

export interface WinnerResult {
  playerId: string
  amount: number
  potIndex: number
  handRank?: WinnerHandRank
}

export interface TableState {
  handNumber: number
  buttonSeat: number
  bettingRound: string
  board: Card[]
  pots: { amount: number; eligible: string[] }[]
  players: {
    id: string
    seat: number
    stack: number
    status: string
    betThisRound: number
    betThisHand: number
    holeCards: Card[] | null
    roundAction: string | null
  }[]
  currentBet: number
  minRaiseTo: number
  actionSeat: number | null
  handComplete: boolean
  winners: WinnerResult[]
}

export interface SeatInfo {
  playerId: string
  stack: number
  rebuyDeadlineAt?: number | null
}

export interface YouState {
  seat: number | null
  holeCards: Card[] | null
  canAct: boolean
  toCall: number
  rebuyDeadlineAt: number | null
  /** Chips releasable on stand (stack + pending add-chips); omitted on older servers */
  releasableStack?: number
}

export interface ServerClockAnchor {
  serverNow: number
  receivedAtPerformanceNow: number
}

export interface PokerTableView {
  tableId: string
  state: TableState
  seats: (SeatInfo | null)[]
  smallBlind: number
  bigBlind: number
  handInProgress: boolean
  showdownActive: boolean
  showdownEndsAt: number | null
  resultKind: 'showdown' | 'fold' | null
  resultDurationMs: number | null
  clockAnchor: ServerClockAnchor | null
  you: YouState
}

export type AddChipsWaitResult =
  | { error: string }
  | { appliesFromNextHand: boolean }
