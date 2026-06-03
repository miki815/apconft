import type { Card, PlayerAction, TableState } from './types.js'

/** Client → server */
export type ClientMessage =
  | { type: 'join'; playerId: string; tableId?: string }
  | { type: 'sit-check'; seat: number; buyIn: number }
  | { type: 'sit'; seat: number; buyIn: number; lockTx?: string }
  | { type: 'stand'; releaseTx?: string }
  | { type: 'start-hand' }
  | { type: 'action'; action: PlayerAction }

export interface SeatInfo {
  playerId: string
  stack: number
}

/** Server → client */
export type ServerMessage =
  | { type: 'joined'; tableId: string; playerId: string }
  | { type: 'sit-check-ok'; seat: number; buyIn: number }
  | {
      type: 'table'
      tableId: string
      state: TableState
      seats: (SeatInfo | null)[]
      smallBlind: number
      bigBlind: number
      handInProgress: boolean
      showdownActive: boolean
      /** Unix ms when showdown phase ends; null if not in showdown */
      showdownEndsAt: number | null
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
}

export const DEFAULT_TABLE_ID = 'main'
export const MAX_SEATS = 6
