import { createDeck, shuffleDeck } from './deck.js'
import { categoryName, compareHands, evaluateBest } from './hand-eval.js'
import { buildPots, splitPot } from './pot.js'
import type {
  ActionResult,
  BettingRound,
  Card,
  PlayerAction,
  PlayerState,
  PlayerStatus,
  TableConfig,
  TableState,
} from './types.js'

interface InternalPlayer {
  id: string
  seat: number
  stack: number
  status: PlayerStatus
  betThisRound: number
  betThisHand: number
  holeCards: Card[] | null
}

const STREET_ORDER: BettingRound[] = [
  'preflop',
  'flop',
  'turn',
  'river',
  'showdown',
]

export class HoldemTable {
  private readonly smallBlind: number
  private readonly bigBlind: number
  private readonly shuffleFn: (cards: Card[]) => Card[]
  private players: InternalPlayer[]
  private deck: Card[] = []
  private deckIdx = 0
  private board: Card[] = []
  private bettingRound: BettingRound = 'preflop'
  private buttonSeat: number
  private handNumber = 0
  private currentBet = 0
  private minRaiseTo = 0
  private actionSeat: number | null = null
  private lastAggressorSeat: number | null = null
  private needsAction = new Set<number>()
  private handComplete = false
  private winners: TableState['winners'] = []
  private pots: TableState['pots'] = []
  /** Seat → action label for the current betting round */
  private roundActions = new Map<number, string>()
  /** True after multi-player showdown — hole cards visible to all */
  private showdownReveal = false

  constructor(config: TableConfig) {
    this.smallBlind = config.smallBlind
    this.bigBlind = config.bigBlind
    this.shuffleFn = config.shuffle ?? shuffleDeck
    this.buttonSeat = config.buttonSeat ?? config.players[0]?.seat ?? 0
    this.minRaiseTo = config.bigBlind * 2
    this.players = config.players.map((p) => ({
      id: p.id,
      seat: p.seat,
      stack: p.stack,
      status: p.stack > 0 ? 'active' : 'sitting-out',
      betThisRound: 0,
      betThisHand: 0,
      holeCards: null,
    }))
  }

  getState(): TableState {
    return {
      handNumber: this.handNumber,
      buttonSeat: this.buttonSeat,
      smallBlindSeat: this.blindSeat('sb'),
      bigBlindSeat: this.blindSeat('bb'),
      bettingRound: this.bettingRound,
      board: [...this.board],
      pots: this.pots.map((p) => ({
        amount: p.amount,
        eligible: [...p.eligible],
      })),
      players: this.players.map((p) => this.publicPlayer(p)),
      currentBet: this.currentBet,
      minRaiseTo: this.minRaiseTo,
      actionSeat: this.actionSeat,
      lastAggressorSeat: this.lastAggressorSeat,
      handComplete: this.handComplete,
      winners: [...this.winners],
    }
  }

  /** Full state for one player (includes their hole cards). */
  isShowdownReveal(): boolean {
    return this.showdownReveal
  }

  /** True when locked runout is in progress and board still has streets to deal. */
  isRunoutPending(): boolean {
    return (
      !this.handComplete &&
      this.actionSeat === null &&
      this.board.length < 5 &&
      this.isLockedRunout()
    )
  }

  /** Deal one runout street segment, or showdown when board reaches 5. */
  advanceRunout(): ActionResult {
    if (this.handComplete) return this.fail('Hand is complete')
    if (!this.isRunoutPending()) {
      return this.fail('No runout pending')
    }

    this.dealRunoutSegment()
    this.needsAction.clear()
    this.actionSeat = null

    if (this.board.length === 5) {
      this.showdown()
    }

    return { ok: true, state: this.getState() }
  }

  getStateForPlayer(playerId: string): TableState {
    const base = this.getState()
    return {
      ...base,
      players: base.players.map((p) =>
        p.id === playerId
          ? {
              ...p,
              holeCards:
                this.players.find((x) => x.id === playerId)?.holeCards ?? null,
            }
          : { ...p, holeCards: null },
      ),
    }
  }

  startHand(): ActionResult {
    if (!this.handComplete && this.handNumber > 0) {
      return this.fail('Previous hand still in progress')
    }

    const seated = this.players.filter(
      (p) => p.stack > 0 && p.status !== 'sitting-out',
    )
    if (seated.length < 2) {
      return this.fail('Need at least 2 players with chips')
    }

    this.handNumber += 1
    this.handComplete = false
    this.winners = []
    this.pots = []
    this.board = []
    this.bettingRound = 'preflop'
    this.currentBet = 0
    this.minRaiseTo = this.bigBlind * 2
    this.lastAggressorSeat = null
    this.needsAction.clear()
    this.roundActions.clear()
    this.showdownReveal = false

    for (const p of this.players) {
      p.betThisRound = 0
      p.betThisHand = 0
      p.holeCards = null
      if (p.stack > 0 && p.status !== 'sitting-out') p.status = 'active'
    }

    this.buttonSeat = this.nextOccupiedSeat(this.buttonSeat)
    this.deck = this.shuffleFn(createDeck())
    this.deckIdx = 0

    const inHand = this.seatedWithChips()
    for (const p of inHand) {
      p.holeCards = [this.draw(), this.draw()]
    }

    this.postBlinds()
    this.seedNeedsActionPreflop()
    this.actionSeat = this.firstPreflopActionSeat()

    return { ok: true, state: this.getState() }
  }

  applyAction(playerId: string, action: PlayerAction): ActionResult {
    if (this.handComplete) return this.fail('Hand is complete')
    const player = this.players.find((p) => p.id === playerId)
    if (!player) return this.fail('Player not at table')
    if (this.actionSeat !== player.seat) {
      return this.fail('Not your turn')
    }
    if (!this.canPlayerAct(player)) {
      return this.fail('You cannot act')
    }

    switch (action.type) {
      case 'fold':
        this.doFold(player)
        this.setRoundAction(player.seat, 'Fold')
        break
      case 'check':
        if (player.betThisRound < this.currentBet) {
          return this.fail('Cannot check facing a bet')
        }
        this.needsAction.delete(player.seat)
        this.setRoundAction(player.seat, 'Check')
        break
      case 'call': {
        const toCall = this.currentBet - player.betThisRound
        if (toCall <= 0) return this.fail('Nothing to call')
        const effectiveCall = Math.min(toCall, player.stack)
        this.commitChips(player, effectiveCall)
        if (player.stack === 0) player.status = 'all-in'
        this.needsAction.delete(player.seat)
        this.setRoundAction(
          player.seat,
          effectiveCall < toCall
            ? `Call all-in ${effectiveCall}`
            : `Call ${toCall}`,
        )
        break
      }
      case 'bet': {
        const err = this.doBetOrRaise(player, action.total, false)
        if (err) return this.fail(err)
        this.setRoundAction(player.seat, `Bet ${action.total}`)
        break
      }
      case 'raise': {
        const err = this.doBetOrRaise(player, action.total, true)
        if (err) return this.fail(err)
        this.setRoundAction(player.seat, `Raise ${action.total}`)
        break
      }
      case 'all-in': {
        const err = this.doAllIn(player)
        if (err) return this.fail(err)
        this.setRoundAction(player.seat, 'All-in')
        break
      }
      default:
        return this.fail('Unknown action')
    }

    const alive = this.playersInHand()
    if (alive.length === 1) {
      this.awardToSingleWinner(alive[0])
      return { ok: true, state: this.getState() }
    }

    if (this.needsAction.size === 0) {
      this.endBettingRound()
    } else {
      this.actionSeat = this.nextActionSeat(this.actionSeat!)
      if (this.actionSeat === null) this.endBettingRound()
    }

    return { ok: true, state: this.getState() }
  }

  private doFold(player: InternalPlayer) {
    player.status = 'folded'
    this.needsAction.delete(player.seat)
  }

  private doBetOrRaise(
    player: InternalPlayer,
    total: number,
    mustRaise: boolean,
  ): string | null {
    if (!Number.isInteger(total) || total <= this.currentBet) {
      return mustRaise
        ? 'Raise total must exceed current bet'
        : 'Bet must exceed current bet'
    }
    if (total < this.minRaiseTo && player.stack > total - player.betThisRound) {
      return `Minimum raise to ${this.minRaiseTo}`
    }
    const toPut = total - player.betThisRound
    if (toPut > player.stack) return 'Not enough chips'
    const prevBet = this.currentBet
    this.commitChips(player, toPut)
    const raiseSize = total - prevBet
    if (raiseSize > 0 && total >= this.minRaiseTo) {
      this.minRaiseTo = total + raiseSize
    }
    this.currentBet = Math.max(this.currentBet, player.betThisRound)
    this.lastAggressorSeat = player.seat
    this.resetNeedsActionAfterAggression(player.seat)
    return null
  }

  private doAllIn(player: InternalPlayer): string | null {
    const toPut = player.stack
    if (toPut <= 0) return 'No chips to put in'
    const newTotal = player.betThisRound + toPut
    const prevBet = this.currentBet
    this.commitChips(player, toPut)
    player.status = 'all-in'

    if (newTotal > this.currentBet) {
      const raiseSize = newTotal - prevBet
      if (newTotal >= this.minRaiseTo) {
        this.minRaiseTo = newTotal + Math.max(raiseSize, this.bigBlind)
      }
      this.currentBet = newTotal
      this.lastAggressorSeat = player.seat
      this.resetNeedsActionAfterAggression(player.seat)
    } else {
      this.needsAction.delete(player.seat)
    }
    return null
  }

  private commitChips(player: InternalPlayer, amount: number) {
    if (amount <= 0) return
    if (amount > player.stack) throw new Error('commit exceeds stack')
    player.stack -= amount
    player.betThisRound += amount
    player.betThisHand += amount
  }

  private returnUncalledBets() {
    const inHand = this.playersInHand()
    if (inHand.length < 2) return

    let maxBet = 0
    for (const p of inHand) {
      if (p.betThisRound > maxBet) maxBet = p.betThisRound
    }

    let secondBet = 0
    for (const p of inHand) {
      if (p.betThisRound < maxBet && p.betThisRound > secondBet) {
        secondBet = p.betThisRound
      }
    }

    if (maxBet <= secondBet) return

    const topPlayers = inHand.filter((p) => p.betThisRound === maxBet)
    if (topPlayers.length !== 1) return

    const refund = maxBet - secondBet
    const top = topPlayers[0]!
    top.stack += refund
    top.betThisRound -= refund
    top.betThisHand -= refund
  }

  private endBettingRound() {
    this.returnUncalledBets()
    const canBetMore = this.playersInHand().some(
      (p) => p.status === 'active' && p.stack > 0,
    )

    if (!canBetMore) {
      this.runOutBoard()
      this.showdown()
      return
    }

    if (this.isLockedRunout()) {
      this.dealRunoutSegment()
      this.currentBet = 0
      this.minRaiseTo = this.bigBlind
      this.lastAggressorSeat = null
      for (const p of this.playersInHand()) {
        p.betThisRound = 0
      }
      this.needsAction.clear()
      this.actionSeat = null
      if (this.board.length === 5 && !this.handComplete) {
        this.showdown()
      }
      return
    }

    const nextStreet = this.nextStreet()
    if (nextStreet === 'showdown') {
      this.showdown()
      return
    }

    this.bettingRound = nextStreet
    this.dealStreetCards(nextStreet)
    this.currentBet = 0
    this.minRaiseTo = this.bigBlind
    this.lastAggressorSeat = null
    this.needsAction.clear()
    this.roundActions.clear()

    for (const p of this.playersInHand()) {
      if (p.status === 'active' && p.stack > 0) {
        this.needsAction.add(p.seat)
      }
      p.betThisRound = 0
    }

    if (this.needsAction.size === 0) {
      this.runOutBoard()
      this.showdown()
      return
    }

    this.actionSeat = this.firstPostflopActionSeat()
    if (this.actionSeat === null) {
      this.runOutBoard()
      this.showdown()
    }
  }

  private nextStreet(): BettingRound {
    const idx = STREET_ORDER.indexOf(this.bettingRound)
    return STREET_ORDER[idx + 1] ?? 'showdown'
  }

  private dealStreetCards(street: BettingRound) {
    if (street === 'flop') {
      this.deckIdx += 1
      this.board.push(this.draw(), this.draw(), this.draw())
    } else if (street === 'turn' || street === 'river') {
      this.deckIdx += 1
      this.board.push(this.draw())
    }
  }

  private isLockedRunout(): boolean {
    const inHand = this.playersInHand()
    if (inHand.length < 2) return false
    const activeWithStack = inHand.filter(
      (p) => p.status === 'active' && p.stack > 0,
    )
    if (activeWithStack.length !== 1) return false
    const lone = activeWithStack[0]!
    return inHand.every(
      (p) => p.id === lone.id || p.status === 'all-in',
    )
  }

  private dealRunoutSegment() {
    if (this.board.length === 0) {
      this.deckIdx += 1
      this.board.push(this.draw(), this.draw(), this.draw())
      this.bettingRound = 'flop'
    } else if (this.board.length === 3) {
      this.deckIdx += 1
      this.board.push(this.draw())
      this.bettingRound = 'turn'
    } else if (this.board.length === 4) {
      this.deckIdx += 1
      this.board.push(this.draw())
      this.bettingRound = 'river'
    }
  }

  private runOutBoard() {
    while (this.board.length < 5) {
      this.dealRunoutSegment()
    }
    this.bettingRound = 'showdown'
  }

  private showdown() {
    this.bettingRound = 'showdown'
    this.showdownReveal = true
    this.handComplete = true
    this.actionSeat = null
    this.needsAction.clear()

    const contributions = this.players
      .filter((p) => p.betThisHand > 0)
      .map((p) => ({ playerId: p.id, amount: p.betThisHand }))

    const folded = new Set(
      this.players.filter((p) => p.status === 'folded').map((p) => p.id),
    )

    this.pots = buildPots(contributions, folded)
    this.winners = []

    for (let i = 0; i < this.pots.length; i++) {
      const pot = this.pots[i]
      const contenders = pot.eligible
        .map((id) => this.players.find((p) => p.id === id)!)
        .filter((p) => p.status !== 'folded')

      let bestIds: string[] = []
      let bestEval: ReturnType<typeof evaluateBest> | null = null

      for (const p of contenders) {
        if (!p.holeCards) continue
        const ev = evaluateBest([...p.holeCards, ...this.board])
        if (!bestEval || compareHands(ev, bestEval) > 0) {
          bestEval = ev
          bestIds = [p.id]
        } else if (bestEval && compareHands(ev, bestEval) === 0) {
          bestIds.push(p.id)
        }
      }

      const shares = splitPot(pot.amount, bestIds)
      for (const s of shares) {
        this.winners.push({
          playerId: s.playerId,
          amount: s.amount,
          potIndex: i,
          ...(bestEval
            ? {
                handRank: {
                  category: bestEval.category,
                  name: categoryName(bestEval.category),
                },
              }
            : {}),
        })
        const pl = this.players.find((p) => p.id === s.playerId)!
        pl.stack += s.amount
      }
    }
  }

  private awardToSingleWinner(winner: InternalPlayer) {
    const total = this.players.reduce((s, p) => s + p.betThisHand, 0)
    winner.stack += total
    this.handComplete = true
    this.actionSeat = null
    this.bettingRound = 'showdown'
    this.winners = [{ playerId: winner.id, amount: total, potIndex: 0 }]
    this.pots = [{ amount: total, eligible: [winner.id] }]
    for (const p of this.players) {
      if (p.id !== winner.id) p.status = p.status === 'folded' ? 'folded' : p.status
    }
  }

  private postBlinds() {
    const sbSeat = this.blindSeat('sb')
    const bbSeat = this.blindSeat('bb')
    const sb = this.playerAtSeat(sbSeat)!
    const bb = this.playerAtSeat(bbSeat)!

    const sbAmt = Math.min(this.smallBlind, sb.stack)
    this.commitChips(sb, sbAmt)
    const bbAmt = Math.min(this.bigBlind, bb.stack)
    this.commitChips(bb, bbAmt)
    if (sb.stack === 0) sb.status = 'all-in'
    if (bb.stack === 0) bb.status = 'all-in'

    this.currentBet = bb.betThisRound
    this.minRaiseTo = this.currentBet + this.bigBlind
    this.lastAggressorSeat = bbSeat
    this.setRoundAction(sb.seat, `SB ${sbAmt}`)
    this.setRoundAction(bb.seat, `BB ${bbAmt}`)
  }

  private setRoundAction(seat: number, label: string) {
    this.roundActions.set(seat, label)
  }

  private seedNeedsActionPreflop() {
    const bbSeat = this.blindSeat('bb')
    for (const p of this.playersInHand()) {
      if (p.seat === bbSeat) continue
      if (p.status === 'active' && p.stack > 0) {
        this.needsAction.add(p.seat)
      }
    }
    if (this.playerAtSeat(bbSeat)!.stack > 0) {
      this.needsAction.add(bbSeat)
    }
  }

  private resetNeedsActionAfterAggression(aggressorSeat: number) {
    this.needsAction.clear()
    for (const p of this.playersInHand()) {
      if (p.seat === aggressorSeat) continue
      if (p.status === 'active' && p.stack > 0) {
        this.needsAction.add(p.seat)
      }
    }
  }

  private firstPreflopActionSeat(): number {
    const n = this.seatsInHandCount()
    if (n === 2) return this.buttonSeat
    return this.nextSeatAfter(this.blindSeat('bb'))
  }

  private firstPostflopActionSeat(): number | null {
    const n = this.seatsInHandCount()
    const preferred = n === 2 ? this.buttonSeat : this.nextSeatAfter(this.buttonSeat)
    const player = this.playerAtSeat(preferred)
    if (player && this.canPlayerAct(player)) return preferred
    return this.nextActionSeat(preferred)
  }

  private nextActionSeat(from: number): number | null {
    let seat = from
    for (let i = 0; i < this.players.length; i++) {
      seat = this.nextOccupiedSeat(seat)
      const p = this.playerAtSeat(seat)
      if (!p || !this.playersInHand().includes(p)) continue
      if (this.needsAction.has(seat) && this.canPlayerAct(p)) return seat
    }
    return null
  }

  private canPlayerAct(p: InternalPlayer): boolean {
    return (
      p.status === 'active' &&
      p.stack > 0 &&
      this.needsAction.has(p.seat)
    )
  }

  private seatedWithChips(): InternalPlayer[] {
    return this.players.filter(
      (p) => p.stack > 0 && p.status !== 'sitting-out',
    )
  }

  private playersInHand(): InternalPlayer[] {
    return this.players.filter(
      (p) =>
        p.holeCards !== null &&
        p.status !== 'folded' &&
        p.status !== 'sitting-out',
    )
  }

  private seatsInHandCount(): number {
    return this.seatedWithChips().length
  }

  private blindSeat(which: 'sb' | 'bb'): number {
    const n = this.seatsInHandCount()
    if (n === 2) {
      return which === 'sb' ? this.buttonSeat : this.nextOccupiedSeat(this.buttonSeat)
    }
    const sb = this.nextOccupiedSeat(this.buttonSeat)
    return which === 'sb' ? sb : this.nextOccupiedSeat(sb)
  }

  private nextSeatAfter(seat: number): number {
    return this.nextOccupiedSeat(seat)
  }

  private nextOccupiedSeat(from: number): number {
    const seats = this.seatedWithChips()
      .map((p) => p.seat)
      .sort((a, b) => a - b)
    if (seats.length === 0) return from
    const idx = seats.findIndex((s) => s > from)
    return idx === -1 ? seats[0]! : seats[idx]!
  }

  private playerAtSeat(seat: number): InternalPlayer | undefined {
    return this.players.find((p) => p.seat === seat)
  }

  private draw(): Card {
    const c = this.deck[this.deckIdx]
    if (!c) throw new Error('Deck exhausted')
    this.deckIdx += 1
    return c
  }

  private publicPlayer(p: InternalPlayer): PlayerState {
    return {
      id: p.id,
      seat: p.seat,
      stack: p.stack,
      status: p.status,
      betThisRound: p.betThisRound,
      betThisHand: p.betThisHand,
      holeCards:
        this.showdownReveal && p.status !== 'folded' ? p.holeCards : null,
      roundAction: this.roundActions.get(p.seat) ?? null,
    }
  }

  private fail(error: string): ActionResult {
    return { ok: false, error, state: this.getState() }
  }
}
