import type { Card, PlayerAction, TableState } from './types.js'

/** Client → server */
export type ClientMessage =
  | { type: 'join'; playerId: string; tableId?: string }
  | { type: 'sit-check'; seat: number; buyIn: number }
  | { type: 'sit'; seat: number; buyIn: number; lockTx?: string }
  | { type: 'add-chips-check'; amount: number }
  | { type: 'add-chips'; amount: number; lockTx?: string }
  | { type: 'stand'; releaseTx?: string }
  | { type: 'start-hand' }
  | { type: 'action'; action: PlayerAction }

export interface SeatInfo {
  playerId: string
  stack: number
  /** Unix ms when rebuy grace ends; only when stack <= 0 and in grace */
  rebuyDeadlineAt?: number | null
}

/** Server → client */
export type ServerMessage =
  | { type: 'joined'; tableId: string; playerId: string }
  | { type: 'sit-check-ok'; seat: number; buyIn: number }
  | { type: 'add-chips-check-ok'; amount: number }
  | { type: 'add-chips-ok'; amount: number; appliesFromNextHand: boolean }
  | {
      type: 'table'
      tableId: string
      state: TableState
      seats: (SeatInfo | null)[]
      smallBlind: number
      bigBlind: number
      handInProgress: boolean
      showdownActive: boolean
      /** Unix ms when the current result display ends; null outside result display. */
      showdownEndsAt: number | null
      /** Result display kind; fold results do not reveal cards. */
      resultKind: 'showdown' | 'fold' | null
      /** Server-authoritative result display duration, used for countdown progress. */
      resultDurationMs: number | null
      /** Unix ms on server when this table message was sent (per connection). */
      serverNow: number
      you: YouState
    }
  | { type: 'error'; message: string }

export interface YouState {
  seat: number | null
  holeCards: Card[] | null
  /** Can send actions right now */
  canAct: boolean
  /** Chips to call */
  toCall: number
  /** Unix ms when rebuy grace ends; null if not in grace */
  rebuyDeadlineAt: number | null
  /** Chips releasable on stand (stack + pending add-chips not yet in stack) */
  releasableStack: number
}

export const DEFAULT_TABLE_ID = 'main'
export const MAX_SEATS = 6
