import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  AddChipsWaitResult,
  PlayerAction,
  PokerTableView,
  SeatInfo,
  TableState,
  YouState,
} from './wsTypes'
import {
  isValidResultDurationMs,
  isValidServerNow,
  isValidShowdownEndsAt,
} from './wsValidation'

export type {
  AddChipsWaitResult,
  Card,
  PlayerAction,
  PokerTableView,
  Rank,
  SeatInfo,
  ServerClockAnchor,
  Suit,
  TableState,
  WinnerHandRank,
  WinnerResult,
  YouState,
} from './wsTypes'

export {
  isValidClockAnchor,
  isValidResultDurationMs,
  isValidServerNow,
  isValidShowdownEndsAt,
} from './wsValidation'

export { cardLabel, preflightSitMessage, shortPk } from './wsHelpers'

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
  | {
      kind: 'add-chips-check'
      amount: number
      resolve: (err: string | null) => void
      timer: ReturnType<typeof setTimeout>
    }
  | {
      kind: 'add-chips'
      amount: number
      resolve: (result: AddChipsWaitResult) => void
      timer: ReturnType<typeof setTimeout>
    }
  | {
      kind: 'stand'
      resolve: (err: string | null) => void
      timer: ReturnType<typeof setTimeout>
    }

/** Input to waitFor — explicit union so TS excess-property check works per kind. */
type PendingRequestInit =
  | { kind: 'sit-check'; seat: number; buyIn: number }
  | { kind: 'sit'; seat: number }
  | { kind: 'add-chips-check'; amount: number }

export function usePokerWs(playerId: string | null) {
  const wsRef = useRef<WebSocket | null>(null)
  const pendingRef = useRef<PendingRequest | null>(null)
  const invalidServerNowWarnedForEndsAtRef = useRef<number | null>(null)
  const [connected, setConnected] = useState(false)
  const [table, setTable] = useState<PokerTableView | null>(null)
  const [error, setError] = useState<string | null>(null)

  const clearPending = useCallback(
    (err: string | null, appliesFromNextHand?: boolean) => {
      const pending = pendingRef.current
      if (!pending) return
      clearTimeout(pending.timer)
      pendingRef.current = null
      if (pending.kind === 'add-chips') {
        if (err === null && appliesFromNextHand !== undefined) {
          pending.resolve({ appliesFromNextHand })
        } else {
          pending.resolve({ error: err ?? 'Error' })
        }
      } else {
        pending.resolve(err)
      }
    },
    [],
  )

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
          resultKind?: 'showdown' | 'fold' | null
          resultDurationMs?: number | null
          serverNow?: unknown
          seat?: number
          buyIn?: number
          amount?: number
          appliesFromNextHand?: boolean
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

        if (msg.type === 'add-chips-check-ok') {
          const pending = pendingRef.current
          if (
            pending?.kind === 'add-chips-check' &&
            pending.amount === msg.amount
          ) {
            clearPending(null)
          }
          return
        }

        if (msg.type === 'add-chips-ok') {
          const pending = pendingRef.current
          if (
            pending?.kind === 'add-chips' &&
            pending.amount === msg.amount
          ) {
            if (typeof msg.appliesFromNextHand !== 'boolean') {
              clearPending(
                'Server nije poslao ispravan add-chips-ok odgovor',
              )
            } else {
              clearPending(null, msg.appliesFromNextHand)
            }
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
          const receivedAtPerformanceNow = performance.now()
          const clockAnchor = isValidServerNow(msg.serverNow)
            ? {
                serverNow: msg.serverNow,
                receivedAtPerformanceNow,
              }
            : null

          const shouldWarnInvalidServerNow =
            msg.resultKind !== null &&
            msg.state.handComplete === true &&
            isValidShowdownEndsAt(msg.showdownEndsAt) &&
            isValidResultDurationMs(msg.resultDurationMs) &&
            !isValidServerNow(msg.serverNow)

          if (
            shouldWarnInvalidServerNow &&
            msg.showdownEndsAt !== invalidServerNowWarnedForEndsAtRef.current
          ) {
            console.warn('Invalid or missing serverNow during result display')
            invalidServerNowWarnedForEndsAtRef.current = msg.showdownEndsAt!
          }

          const next: PokerTableView = {
            tableId: msg.tableId!,
            state: msg.state,
            seats: msg.seats ?? [],
            smallBlind: msg.smallBlind ?? 5,
            bigBlind: msg.bigBlind ?? 10,
            handInProgress: msg.handInProgress ?? false,
            showdownActive: msg.showdownActive ?? false,
            showdownEndsAt: msg.showdownEndsAt ?? null,
            resultKind: msg.resultKind ?? null,
            resultDurationMs: msg.resultDurationMs ?? null,
            clockAnchor,
            you: {
              ...msg.you,
              rebuyDeadlineAt: msg.you.rebuyDeadlineAt ?? null,
              ...(typeof msg.you.releasableStack === 'number'
                ? { releasableStack: msg.you.releasableStack }
                : {}),
            },
          }
          setTable(next)

          const pending = pendingRef.current
          if (pending?.kind === 'sit' && msg.you.seat === pending.seat) {
            clearPending(null)
          }

          if (pending?.kind === 'stand' && msg.you.seat === null) {
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
    (pending: PendingRequestInit) =>
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

  const checkAddChips = useCallback(
    async (amount: number): Promise<string | null> => {
      send({ type: 'add-chips-check', amount })
      return waitFor({ kind: 'add-chips-check', amount })
    },
    [send, waitFor],
  )

  const addChipsAndWait = useCallback(
    async (amount: number, lockTx?: string): Promise<AddChipsWaitResult> =>
      new Promise((resolve) => {
        if (pendingRef.current) {
          resolve({ error: 'Prethodni zahtev još traje' })
          return
        }
        const timer = setTimeout(() => {
          if (pendingRef.current?.kind === 'add-chips') {
            clearPending('Server nije odgovorio na vreme')
          }
        }, WS_TIMEOUT_MS)
        pendingRef.current = {
          kind: 'add-chips',
          amount,
          resolve,
          timer,
        }
        send({ type: 'add-chips', amount, lockTx })
      }),
    [send, clearPending],
  )

  const standAndWait = useCallback(
    async (releaseTx?: string): Promise<string | null> =>
      new Promise((resolve) => {
        if (pendingRef.current) {
          resolve('Prethodni zahtev još traje')
          return
        }
        const timer = setTimeout(() => {
          if (pendingRef.current?.kind === 'stand') {
            clearPending('Server nije odgovorio na vreme')
          }
        }, WS_TIMEOUT_MS)
        pendingRef.current = {
          kind: 'stand',
          resolve,
          timer,
        }
        send({ type: 'stand', releaseTx })
      }),
    [send, clearPending],
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
    checkAddChips,
    addChipsAndWait,
    standAndWait,
    startHand,
    act,
  }
}

