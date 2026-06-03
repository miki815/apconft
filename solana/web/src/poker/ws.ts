import { useCallback, useEffect, useRef, useState } from 'react'

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
  winners: { playerId: string; amount: number }[]
}

export interface SeatInfo {
  playerId: string
  stack: number
}

export interface YouState {
  seat: number | null
  holeCards: Card[] | null
  canAct: boolean
  toCall: number
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
  you: YouState
}

const WS_URL =
  import.meta.env.VITE_POKER_WS_URL || 'ws://localhost:3081'

const WS_TIMEOUT_MS = 12_000

type PendingRequest =
  | {
      kind: 'sit-check'
      seat: number
      buyIn: number
      resolve: (err: string | null) => void
      timer: ReturnType<typeof setTimeout>
    }
  | {
      kind: 'sit'
      seat: number
      resolve: (err: string | null) => void
      timer: ReturnType<typeof setTimeout>
    }

export function usePokerWs(playerId: string | null) {
  const wsRef = useRef<WebSocket | null>(null)
  const pendingRef = useRef<PendingRequest | null>(null)
  const [connected, setConnected] = useState(false)
  const [table, setTable] = useState<PokerTableView | null>(null)
  const [error, setError] = useState<string | null>(null)

  const clearPending = useCallback((err: string | null) => {
    const pending = pendingRef.current
    if (!pending) return
    clearTimeout(pending.timer)
    pendingRef.current = null
    pending.resolve(err)
  }, [])

  const send = useCallback((msg: object) => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    }
  }, [])

  useEffect(() => {
    if (!playerId) {
      setConnected(false)
      setTable(null)
      wsRef.current?.close()
      wsRef.current = null
      return
    }

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      setError(null)
      ws.send(JSON.stringify({ type: 'join', playerId }))
    }

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as {
          type: string
          message?: string
          state?: TableState
          you?: YouState
          seats?: (SeatInfo | null)[]
          tableId?: string
          smallBlind?: number
          bigBlind?: number
          handInProgress?: boolean
          showdownActive?: boolean
          showdownEndsAt?: number | null
          seat?: number
          buyIn?: number
        }

        if (msg.type === 'sit-check-ok') {
          const pending = pendingRef.current
          if (
            pending?.kind === 'sit-check' &&
            pending.seat === msg.seat &&
            pending.buyIn === msg.buyIn
          ) {
            clearPending(null)
          }
          return
        }

        if (msg.type === 'error') {
          const pending = pendingRef.current
          if (pending) {
            clearPending(msg.message ?? 'Error')
          }
          setError(msg.message ?? 'Error')
          return
        }

        if (msg.type === 'table' && msg.state && msg.you) {
          const next: PokerTableView = {
            tableId: msg.tableId!,
            state: msg.state,
            seats: msg.seats ?? [],
            smallBlind: msg.smallBlind ?? 5,
            bigBlind: msg.bigBlind ?? 10,
            handInProgress: msg.handInProgress ?? false,
            showdownActive: msg.showdownActive ?? false,
            showdownEndsAt: msg.showdownEndsAt ?? null,
            you: msg.you,
          }
          setTable(next)

          const pending = pendingRef.current
          if (pending?.kind === 'sit' && msg.you.seat === pending.seat) {
            clearPending(null)
          }

          if (!pendingRef.current) {
            setError(null)
          }
        }
      } catch {
        setError('Bad server message')
      }
    }

    ws.onclose = () => {
      setConnected(false)
      clearPending('Veza sa serverom prekinuta')
    }
    ws.onerror = () => setError('WebSocket connection failed')

    return () => {
      clearPending('Veza zatvorena')
      ws.close()
      wsRef.current = null
    }
  }, [playerId, clearPending])

  const waitFor = useCallback(
    (pending: Omit<PendingRequest, 'timer' | 'resolve'>) =>
      new Promise<string | null>((resolve) => {
        if (pendingRef.current) {
          resolve('Prethodni zahtev još traje')
          return
        }
        const timer = setTimeout(() => {
          if (pendingRef.current) {
            clearPending('Server nije odgovorio na vreme')
          }
        }, WS_TIMEOUT_MS)
        pendingRef.current = {
          ...pending,
          resolve,
          timer,
        } as PendingRequest
      }),
    [clearPending],
  )

  const checkSit = useCallback(
    async (seat: number, buyIn: number): Promise<string | null> => {
      send({ type: 'sit-check', seat, buyIn })
      return waitFor({ kind: 'sit-check', seat, buyIn })
    },
    [send, waitFor],
  )

  const sitAndWait = useCallback(
    async (
      seat: number,
      buyIn: number,
      lockTx?: string,
    ): Promise<string | null> => {
      send({ type: 'sit', seat, buyIn, lockTx })
      return waitFor({ kind: 'sit', seat })
    },
    [send, waitFor],
  )

  const stand = useCallback(
    (releaseTx?: string) => send({ type: 'stand', releaseTx }),
    [send],
  )
  const startHand = useCallback(() => send({ type: 'start-hand' }), [send])
  const act = useCallback(
    (action: PlayerAction) => send({ type: 'action', action }),
    [send],
  )

  return {
    connected,
    table,
    error,
    checkSit,
    sitAndWait,
    stand,
    startHand,
    act,
  }
}

export function cardLabel(c: Card): string {
  const r =
    c.rank === 14
      ? 'A'
      : c.rank === 13
        ? 'K'
        : c.rank === 12
          ? 'Q'
          : c.rank === 11
            ? 'J'
            : c.rank === 10
              ? 'T'
              : String(c.rank)
  const s =
    c.suit === 'h'
      ? '♥'
      : c.suit === 'd'
        ? '♦'
        : c.suit === 'c'
          ? '♣'
          : '♠'
  return `${r}${s}`
}

export function shortPk(pk: string): string {
  return `${pk.slice(0, 4)}…${pk.slice(-4)}`
}

export function preflightSitMessage(
  table: PokerTableView | null,
  pickSeat: number,
  buyIn: number,
): string | null {
  if (!table) return 'Nema podataka o stolu — sačekaj konekciju'
  if (table.handInProgress || table.showdownActive) {
    return 'Ne možeš da sedneš tokom ruke'
  }
  if (table.you.seat !== null) return 'Već si za stolom'
  if (table.seats[pickSeat]) return `Mesto ${pickSeat + 1} je zauzeto`
  if (!Number.isInteger(buyIn) || buyIn <= 0) return 'Unesi ispravan buy-in'
  return null
}
