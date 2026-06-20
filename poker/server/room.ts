import { Connection, PublicKey } from '@solana/web3.js'
import { HoldemTable } from '../src/index.js'
import {
  DEFAULT_TABLE_ID,
  MAX_SEATS,
  type SeatInfo,
  type YouState,
} from '../src/protocol.js'
import type { PlayerAction, TableState } from '../src/types.js'
import {
  isSkipVaultCheck,
  POKER_TABLE_MINT,
  SOLANA_RPC_URL,
} from './config.js'
import { verifyTableVaultTx } from './vaultTx.js'

export { DEFAULT_TABLE_ID, MAX_SEATS }

export const SHOWDOWN_MS = 5000
export const ACTION_TIMEOUT_MS = 30_000
export const REBUY_GRACE_MS = 60_000
export const RUNOUT_STREET_MS = 1200

interface Seat {
  playerId: string
  stack: number
  pendingStackAdd: number
  rebuyDeadlineAt: number | null
}

export interface RoomSnapshot {
  tableId: string
  smallBlind: number
  bigBlind: number
  seats: (SeatInfo | null)[]
  state: TableState | null
  handInProgress: boolean
  showdownActive: boolean
  showdownEndsAt: number | null
  resultKind: 'showdown' | 'fold' | null
  resultDurationMs: number | null
}

interface ActionTimerToken {
  seq: number
  seat: number
  playerId: string
}

export class PokerRoom {
  readonly tableId: string
  readonly smallBlind: number
  readonly bigBlind: number
  onTableUpdate?: () => void

  private readonly seats: (Seat | null)[] = Array.from(
    { length: MAX_SEATS },
    () => null,
  )
  private table: HoldemTable | null = null
  private lastButtonSeat = 0
  private inShowdown = false
  private showdownEndsAt: number | null = null
  private resultKind: 'showdown' | 'fold' | null = null
  private resultDurationMs: number | null = null
  private showdownTimer: ReturnType<typeof setTimeout> | null = null
  private resultTimerSeq = 0
  private readonly actionTimeoutMs: number
  private readonly rebuyGraceMs: number
  private readonly runoutStreetMs: number
  private actionTimer: ReturnType<typeof setTimeout> | null = null
  private actionTimerSeq = 0
  private actionTimerToken: ActionTimerToken | null = null
  private runoutTimer: ReturnType<typeof setTimeout> | null = null
  private runoutTimerSeq = 0
  private readonly rebuyTimers = new Map<number, ReturnType<typeof setTimeout>>()
  private readonly rebuyTimerSeq = new Map<number, number>()
  private readonly vaultConnection = new Connection(SOLANA_RPC_URL, 'confirmed')
  private readonly tableMint: PublicKey | null = POKER_TABLE_MINT
    ? new PublicKey(POKER_TABLE_MINT)
    : null
  private readonly usedVaultTxSigs = new Set<string>()

  constructor(
    tableId: string,
    opts?: {
      smallBlind?: number
      bigBlind?: number
      actionTimeoutMs?: number
      rebuyGraceMs?: number
      runoutStreetMs?: number
    },
  ) {
    this.tableId = tableId
    this.smallBlind = opts?.smallBlind ?? 5
    this.bigBlind = opts?.bigBlind ?? 10
    this.actionTimeoutMs = opts?.actionTimeoutMs ?? ACTION_TIMEOUT_MS
    this.rebuyGraceMs = opts?.rebuyGraceMs ?? REBUY_GRACE_MS
    this.runoutStreetMs = opts?.runoutStreetMs ?? RUNOUT_STREET_MS
  }

  private seatInfo(
    s: Seat,
    seatIdx: number,
    state: TableState | null,
    handInProgress: boolean,
  ): SeatInfo {
    let stack = s.stack
    if (state && handInProgress) {
      const live = state.players.find((p) => p.seat === seatIdx)
      if (live) stack = live.stack
    }
    const info: SeatInfo = { playerId: s.playerId, stack }
    if (stack <= 0 && s.rebuyDeadlineAt !== null) {
      info.rebuyDeadlineAt = s.rebuyDeadlineAt
    }
    return info
  }

  snapshot(): RoomSnapshot {
    const state = this.table?.getState() ?? null
    const handInProgress =
      this.table !== null &&
      state !== null &&
      (!state.handComplete || this.isResultDisplayActive())

    const seats = this.seats.map((s, seatIdx) => {
      if (!s) return null
      return this.seatInfo(s, seatIdx, state, handInProgress)
    })

    return {
      tableId: this.tableId,
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind,
      seats,
      state,
      handInProgress,
      showdownActive: this.inShowdown,
      showdownEndsAt: this.showdownEndsAt,
      resultKind: this.resultKind,
      resultDurationMs: this.resultDurationMs,
    }
  }

  async sit(
    playerId: string,
    seat: number,
    buyIn: number,
    lockTx?: string,
  ): Promise<string | null> {
    let err = this.checkSit(playerId, seat, buyIn)
    if (err) return err

    const vaultRequired = !isSkipVaultCheck() && this.tableMint !== null

    if (vaultRequired) {
      let pubkey: PublicKey
      try {
        pubkey = new PublicKey(playerId)
      } catch {
        return 'Invalid wallet address'
      }

      if (!lockTx) {
        return 'Missing lock transaction — sign lock_for_table in wallet first'
      }

      const verifyErr = await verifyTableVaultTx(
        this.vaultConnection,
        lockTx,
        pubkey,
        this.tableMint!,
        'lock_for_table',
        buyIn,
      )
      if (verifyErr) return verifyErr

      err = this.checkSit(playerId, seat, buyIn)
      if (err) return err

      const replay = this.consumeVaultTx(lockTx)
      if (replay) return replay
    }

    const seatedBefore = this.seats.filter(Boolean).length
    this.seats[seat] = {
      playerId,
      stack: buyIn,
      pendingStackAdd: 0,
      rebuyDeadlineAt: null,
    }
    this.tryAutoStartHand(seatedBefore)
    return null
  }

  /** Validates sit without requiring lock tx (preflight). */
  checkSit(playerId: string, seat: number, buyIn: number): string | null {
    if (!Number.isInteger(seat) || seat < 0 || seat >= MAX_SEATS) {
      return 'Invalid seat'
    }
    if (!Number.isInteger(buyIn) || buyIn <= 0) return 'buyIn must be positive'
    if (this.seats[seat]) return 'Seat taken'
    if (this.findSeat(playerId) !== null) return 'Already seated'
    return null
  }

  /** Validates chip add without requiring lock tx (preflight). */
  checkAddChips(playerId: string, amount: number): string | null {
    const seat = this.findSeat(playerId)
    if (seat === null || !this.seats[seat]) return 'Not seated'
    if (!Number.isInteger(amount) || amount <= 0) return 'amount must be positive'
    return null
  }

  async addChips(
    playerId: string,
    amount: number,
    lockTx?: string,
  ): Promise<string | { appliesFromNextHand: boolean }> {
    let err = this.checkAddChips(playerId, amount)
    if (err) return err

    const vaultRequired = !isSkipVaultCheck() && this.tableMint !== null

    if (vaultRequired) {
      let pubkey: PublicKey
      try {
        pubkey = new PublicKey(playerId)
      } catch {
        return 'Invalid wallet address'
      }

      if (!lockTx) {
        return 'Missing lock transaction — sign lock_for_table in wallet first'
      }

      const verifyErr = await verifyTableVaultTx(
        this.vaultConnection,
        lockTx,
        pubkey,
        this.tableMint!,
        'lock_for_table',
        amount,
      )
      if (verifyErr) return verifyErr

      err = this.checkAddChips(playerId, amount)
      if (err) return err

      const replay = this.consumeVaultTx(lockTx)
      if (replay) return replay
    }

    const seatNow = this.findSeat(playerId)
    if (seatNow === null || this.seats[seatNow]?.playerId !== playerId) {
      return 'Not seated'
    }

    const s = this.seats[seatNow]!

    if (s.rebuyDeadlineAt !== null && !this.isPlayerInCurrentHand(playerId)) {
      s.stack += amount
      this.clearRebuyGrace(seatNow)
      this.maybeAutoStartAfterRebuy()
      return { appliesFromNextHand: false }
    }

    const appliesFromNextHand = this.isHandActive()
    if (appliesFromNextHand) {
      s.pendingStackAdd += amount
    } else {
      s.stack += amount
    }

    if (s.stack > 0 || s.pendingStackAdd > 0) {
      this.clearRebuyGrace(seatNow)
    }
    this.maybeAutoStartAfterRebuy()

    return { appliesFromNextHand }
  }

  async stand(playerId: string, releaseTx?: string): Promise<string | null> {
    if (this.isHandActive() && this.isPlayerInCurrentHand(playerId)) {
      return 'Cannot leave during a hand'
    }
    const seat = this.findSeat(playerId)
    if (seat === null) return 'Not seated'

    const releasable = this.releasableStack(seat, playerId)
    const vaultRequired = !isSkipVaultCheck() && this.tableMint !== null

    if (vaultRequired && releasable > 0) {
      let pubkey: PublicKey
      try {
        pubkey = new PublicKey(playerId)
      } catch {
        return 'Invalid wallet address'
      }

      if (!releaseTx) {
        return 'Missing release transaction — sign release_from_table in wallet first'
      }

      const verifyErr = await verifyTableVaultTx(
        this.vaultConnection,
        releaseTx,
        pubkey,
        this.tableMint!,
        'release_from_table',
        releasable,
      )
      if (verifyErr) return verifyErr

      const replay = this.consumeVaultTx(releaseTx)
      if (replay) return replay
    }

    this.clearRebuyGrace(seat)
    this.seats[seat] = null
    if (!this.isHandActive()) {
      this.tryAutoStartNextHandAfterFinish()
    }
    return null
  }

  startHand(): string | null {
    if (this.isHandActive()) return 'Hand already in progress'
    this.applyPendingStackAdds()
    this.removeExpiredRebuySeats()

    const seated = this.seats
      .map((s, seat) =>
        s && s.stack > 0 ? { id: s.playerId, seat, stack: s.stack } : null,
      )
      .filter((x): x is { id: string; seat: number; stack: number } => x !== null)

    if (seated.length < 2) return 'Need at least 2 seated players'

    this.table = new HoldemTable({
      players: seated,
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind,
      buttonSeat: this.lastButtonSeat,
    })

    const r = this.table.startHand()
    if (!r.ok) {
      this.table = null
      this.clearActionTimer()
      return r.error ?? 'Failed to start hand'
    }

    this.lastButtonSeat = r.state.buttonSeat
    this.scheduleActionTimer()
    return null
  }

  applyAction(playerId: string, action: PlayerAction): string | null {
    this.clearActionTimer()
    this.clearRunoutTimer()
    if (!this.table) return 'No hand in progress'
    const r = this.table.applyAction(playerId, action)
    if (!r.ok) {
      this.maybeRescheduleActionTimer()
      return r.error ?? 'Invalid action'
    }

    this.afterTableProgress()
    return null
  }

  private afterTableProgress() {
    if (!this.table) return
    const state = this.table.getState()
    if (state.handComplete) {
      if (this.table.isShowdownReveal()) {
        this.beginResultDisplay('showdown')
      } else {
        this.beginResultDisplay('fold')
      }
    } else if (this.table.isRunoutPending()) {
      this.continueRunout()
    } else {
      this.scheduleActionTimer()
    }
  }

  youState(playerId: string): YouState {
    const seat = this.findSeat(playerId)
    const state = this.table?.getState() ?? null
    let holeCards: YouState['holeCards'] = null
    let canAct = false
    let toCall = 0
    let rebuyDeadlineAt: number | null = null

    if (seat !== null && this.seats[seat]) {
      const s = this.seats[seat]!
      if (s.stack <= 0 && s.rebuyDeadlineAt !== null) {
        rebuyDeadlineAt = s.rebuyDeadlineAt
      }
    }

    if (this.table && seat !== null) {
      const priv = this.table.getStateForPlayer(playerId)
      const me = priv.players.find((p) => p.id === playerId)
      holeCards = me?.holeCards ?? null
      if (
        state &&
        state.actionSeat === seat &&
        me &&
        !this.isResultDisplayActive()
      ) {
        canAct = me.status === 'active' && me.stack > 0
        toCall = Math.max(0, state.currentBet - me.betThisRound)
      }
    }

    const releasableStack =
      seat !== null ? this.releasableStack(seat, playerId) : 0

    return { seat, holeCards, canAct, toCall, rebuyDeadlineAt, releasableStack }
  }

  private countEligibleForHand(): number {
    let n = 0
    for (const s of this.seats) {
      if (s && s.stack > 0) n++
    }
    return n
  }

  private isPlayerInCurrentHand(playerId: string): boolean {
    if (!this.table) return false
    return this.table.getState().players.some((p) => p.id === playerId)
  }

  private maybeAutoStartAfterRebuy(): void {
    if (!this.isHandActive() && this.countEligibleForHand() >= 2) {
      this.tryAutoStartNextHandAfterFinish()
    }
  }

  private tryAutoStartHand(seatedBefore: number): void {
    if (this.isHandActive()) return
    if (seatedBefore >= 2) return
    if (this.seats.filter(Boolean).length < 2) return
    this.startHand()
  }

  private consumeVaultTx(sig: string): string | null {
    if (this.usedVaultTxSigs.has(sig)) {
      return 'Vault transaction already used'
    }
    this.usedVaultTxSigs.add(sig)
    return null
  }

  private currentStack(seat: number, playerId: string): number {
    const state = this.table?.getState() ?? null
    const handInProgress =
      this.table !== null &&
      state !== null &&
      (!state.handComplete || this.isResultDisplayActive())
    if (state && handInProgress) {
      const live = state.players.find((p) => p.seat === seat)
      if (live) return live.stack
    }
    return this.seats[seat]?.stack ?? 0
  }

  private releasableStack(seat: number, playerId: string): number {
    const base = this.currentStack(seat, playerId)
    const pending = this.seats[seat]?.pendingStackAdd ?? 0
    return base + pending
  }

  private clearRunoutTimer() {
    if (this.runoutTimer) {
      clearTimeout(this.runoutTimer)
      this.runoutTimer = null
    }
    this.runoutTimerSeq++
  }

  private continueRunout() {
    if (!this.table || this.isResultDisplayActive()) return
    if (this.runoutStreetMs <= 0) {
      this.drainRunout()
      return
    }
    this.scheduleRunoutStep()
  }

  private drainRunout() {
    if (!this.table) return
    while (this.table.isRunoutPending()) {
      const r = this.table.advanceRunout()
      if (!r.ok) break
      if (r.state.handComplete) {
        this.beginResultDisplay(this.table.isShowdownReveal() ? 'showdown' : 'fold')
        return
      }
    }
  }

  private scheduleRunoutStep() {
    if (this.runoutTimer) {
      clearTimeout(this.runoutTimer)
      this.runoutTimer = null
    }
    if (!this.table || this.isResultDisplayActive()) return
    if (!this.table.isRunoutPending()) return

    const seq = ++this.runoutTimerSeq
    this.runoutTimer = setTimeout(
      () => this.onRunoutStep(seq),
      this.runoutStreetMs,
    )
    this.runoutTimer.unref()
  }

  private onRunoutStep(seq: number) {
    if (seq !== this.runoutTimerSeq) return

    this.runoutTimer = null

    if (!this.table || this.isResultDisplayActive()) return
    if (!this.table.isRunoutPending()) return

    const r = this.table.advanceRunout()
    if (!r.ok) return

    this.onTableUpdate?.()

    if (r.state.handComplete) {
      this.clearRunoutTimer()
      this.beginResultDisplay(this.table.isShowdownReveal() ? 'showdown' : 'fold')
      return
    }

    if (this.table.isRunoutPending()) {
      this.scheduleRunoutStep()
    }
  }

  private clearActionTimer() {
    if (this.actionTimer) {
      clearTimeout(this.actionTimer)
      this.actionTimer = null
    }
    this.actionTimerToken = null
    this.actionTimerSeq++
  }

  private scheduleActionTimer() {
    if (this.actionTimeoutMs <= 0) return
    if (this.actionTimer) {
      clearTimeout(this.actionTimer)
      this.actionTimer = null
    }
    if (!this.table || this.isResultDisplayActive()) return

    const state = this.table.getState()
    if (state.handComplete || state.actionSeat === null) return

    const seat = state.actionSeat
    const player = state.players.find((p) => p.seat === seat)
    if (!player || player.status !== 'active' || player.stack <= 0) return

    const seq = ++this.actionTimerSeq
    const token: ActionTimerToken = { seq, seat, playerId: player.id }
    this.actionTimerToken = token
    this.actionTimer = setTimeout(
      () => this.onActionTimeout(token),
      this.actionTimeoutMs,
    )
    this.actionTimer.unref()
  }

  private maybeRescheduleActionTimer() {
    if (this.actionTimeoutMs <= 0) return
    if (!this.table || this.isResultDisplayActive()) return
    const state = this.table.getState()
    if (state.handComplete || state.actionSeat === null) return
    this.scheduleActionTimer()
  }

  private onActionTimeout(token: ActionTimerToken) {
    if (token.seq !== this.actionTimerSeq) {
      return
    }

    this.actionTimer = null
    this.actionTimerToken = null

    if (!this.table || this.isResultDisplayActive()) return

    const state = this.table.getState()
    if (state.handComplete) return
    if (state.actionSeat !== token.seat) return

    const player = state.players.find((p) => p.seat === token.seat)
    if (!player || player.id !== token.playerId) return
    if (player.status !== 'active' || player.stack <= 0) return

    const toCall = Math.max(0, state.currentBet - player.betThisRound)
    const action: PlayerAction =
      toCall > 0 ? { type: 'fold' } : { type: 'check' }

    const err = this.applyAction(player.id, action)
    if (!err && !this.isResultDisplayActive()) this.onTableUpdate?.()
  }

  private beginResultDisplay(kind: 'showdown' | 'fold') {
    if (this.isResultDisplayActive()) return
    this.clearActionTimer()
    this.clearRunoutTimer()
    this.resultKind = kind
    this.inShowdown = kind === 'showdown'
    this.showdownEndsAt = Date.now() + SHOWDOWN_MS
    this.resultDurationMs = SHOWDOWN_MS
    this.onTableUpdate?.()
    if (this.showdownTimer) clearTimeout(this.showdownTimer)
    const seq = ++this.resultTimerSeq
    this.showdownTimer = setTimeout(() => {
      if (seq !== this.resultTimerSeq) return
      this.showdownTimer = null
      this.finishHand()
      this.onTableUpdate?.()
    }, SHOWDOWN_MS)
    this.showdownTimer.unref()
  }

  private finishHand() {
    this.clearActionTimer()
    this.clearRunoutTimer()
    this.resultTimerSeq++
    if (this.showdownTimer) {
      clearTimeout(this.showdownTimer)
      this.showdownTimer = null
    }
    this.inShowdown = false
    this.showdownEndsAt = null
    this.resultKind = null
    this.resultDurationMs = null
    this.syncStacksFromTable()
    this.applyPendingStackAdds()
    this.enterRebuyGraceForZeroStacks()
    this.removeExpiredRebuySeats()
    this.table = null
    this.tryAutoStartNextHandAfterFinish()
  }

  private tryAutoStartNextHandAfterFinish(): void {
    if (this.isHandActive()) return
    if (this.countEligibleForHand() < 2) return
    this.startHand()
  }

  private isHandActive(): boolean {
    if (!this.table) return false
    if (this.isResultDisplayActive()) return true
    return !this.table.getState().handComplete
  }

  private isResultDisplayActive(): boolean {
    return this.resultKind !== null
  }

  private findSeat(playerId: string): number | null {
    const idx = this.seats.findIndex((s) => s?.playerId === playerId)
    return idx === -1 ? null : idx
  }

  private syncStacksFromTable() {
    if (!this.table) return
    const state = this.table.getState()
    for (const p of state.players) {
      const seat = this.findSeat(p.id)
      if (seat !== null && this.seats[seat]) {
        const prev = this.seats[seat]!
        const pending = prev.pendingStackAdd
        const rebuyDeadlineAt = p.stack > 0 ? null : prev.rebuyDeadlineAt
        this.seats[seat] = {
          playerId: p.id,
          stack: p.stack,
          pendingStackAdd: pending,
          rebuyDeadlineAt,
        }
      }
    }
  }

  /** Idempotent: merges pending into stack and resets pending to 0. */
  private applyPendingStackAdds() {
    for (let seat = 0; seat < MAX_SEATS; seat++) {
      const s = this.seats[seat]
      if (!s || s.pendingStackAdd <= 0) continue
      s.stack += s.pendingStackAdd
      s.pendingStackAdd = 0
      if (s.stack > 0) {
        this.clearRebuyGrace(seat)
      }
    }
  }

  private enterRebuyGraceForZeroStacks() {
    if (this.rebuyGraceMs <= 0) return
    const now = Date.now()
    for (let seat = 0; seat < MAX_SEATS; seat++) {
      const s = this.seats[seat]
      if (!s || s.stack > 0) continue
      if (s.rebuyDeadlineAt !== null) continue
      s.rebuyDeadlineAt = now + this.rebuyGraceMs
      this.scheduleRebuyGraceTimer(seat)
      this.onTableUpdate?.()
    }
  }

  private removeExpiredRebuySeats() {
    const now = Date.now()
    for (let seat = 0; seat < MAX_SEATS; seat++) {
      const s = this.seats[seat]
      if (!s || s.stack > 0) continue
      if (s.pendingStackAdd > 0) continue
      if (s.rebuyDeadlineAt === null) continue
      if (now < s.rebuyDeadlineAt) continue
      this.clearRebuyGrace(seat)
      this.seats[seat] = null
    }
  }

  private clearRebuyGrace(seat: number) {
    const timer = this.rebuyTimers.get(seat)
    if (timer) {
      clearTimeout(timer)
      this.rebuyTimers.delete(seat)
    }
    const s = this.seats[seat]
    if (s) {
      s.rebuyDeadlineAt = null
    }
    this.rebuyTimerSeq.set(seat, (this.rebuyTimerSeq.get(seat) ?? 0) + 1)
  }

  private scheduleRebuyGraceTimer(seat: number) {
    if (this.rebuyGraceMs <= 0) return
    const s = this.seats[seat]
    if (!s || s.rebuyDeadlineAt === null) return

    const existing = this.rebuyTimers.get(seat)
    if (existing) clearTimeout(existing)

    const seq = (this.rebuyTimerSeq.get(seat) ?? 0) + 1
    this.rebuyTimerSeq.set(seat, seq)
    const playerId = s.playerId
    const delay = Math.max(0, s.rebuyDeadlineAt - Date.now())

    const timer = setTimeout(() => {
      this.rebuyTimers.delete(seat)
      this.onRebuyGraceExpired(seat, playerId, seq)
    }, delay)
    timer.unref()
    this.rebuyTimers.set(seat, timer)
  }

  private onRebuyGraceExpired(seat: number, playerId: string, seq: number) {
    if ((this.rebuyTimerSeq.get(seat) ?? 0) !== seq) return

    const s = this.seats[seat]
    if (!s || s.playerId !== playerId) return
    if (s.rebuyDeadlineAt === null) return
    if (s.stack > 0 || s.pendingStackAdd > 0) return
    if (Date.now() < s.rebuyDeadlineAt) return

    this.clearRebuyGrace(seat)
    this.seats[seat] = null
    this.onTableUpdate?.()
    if (!this.isHandActive()) {
      this.tryAutoStartNextHandAfterFinish()
    }
  }
}
