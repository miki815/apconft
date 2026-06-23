import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import anchor, { BorshInstructionCoder, type Idl } from '@coral-xyz/anchor'
import { MINT_SIZE, MintLayout, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import {
  Keypair,
  PublicKey,
  type VersionedTransactionResponse,
} from '@solana/web3.js'
import { TABLE_VAULT_PROGRAM_ID } from './config.js'
import { PokerRoom, SHOWDOWN_MS, type RoomSnapshot } from './room.js'
import { verifyTableVaultTx, type TableVaultIx } from './vaultTx.js'
import { loadVaultIdl } from './vaultBalance.js'

process.env.POKER_SKIP_VAULT_CHECK = '1'

const noTimer = { actionTimeoutMs: 0, runoutStreetMs: 0 }
const fastTimer = { actionTimeoutMs: 20, runoutStreetMs: 0 }
const fastRebuy = { actionTimeoutMs: 0, rebuyGraceMs: 50, runoutStreetMs: 0 }
const fastRunout = { actionTimeoutMs: 0, runoutStreetMs: 50 }
const timerWait = fastTimer.actionTimeoutMs! + 50
const runoutWait = fastRunout.runoutStreetMs! + 50
const rebuyWait = fastRebuy.rebuyGraceMs! + 50

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const flushTimers = () => new Promise<void>((r) => setImmediate(r))

async function waitForActionTimer() {
  await sleep(timerWait)
  await flushTimers()
}

async function waitForRebuyTimer() {
  await sleep(rebuyWait)
  await flushTimers()
}

async function waitUntilActionSeatChanges(
  room: PokerRoom,
  seatBefore: number,
  maxMs = 200,
) {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    await flushTimers()
    const state = room.snapshot().state
    if (state && state.actionSeat !== seatBefore) return state
    await sleep(10)
  }
  return room.snapshot().state!
}

function stopRoomTimer(room: PokerRoom) {
  ;(room as unknown as { clearActionTimer(): void }).clearActionTimer()
}

type SeatInternal = {
  playerId: string
  stack: number
  pendingStackAdd: number
  rebuyDeadlineAt: number | null
}

function roomSeats(room: PokerRoom): (SeatInternal | null)[] {
  return (room as unknown as { seats: (SeatInternal | null)[] }).seats
}

function applyPendingStackAdds(room: PokerRoom) {
  ;(room as unknown as { applyPendingStackAdds(): void }).applyPendingStackAdds()
}

function forceFinishShowdown(room: PokerRoom) {
  const r = room as unknown as {
    inShowdown: boolean
    resultKind: 'showdown' | 'fold' | null
    finishHand(): void
  }
  if (r.inShowdown || r.resultKind !== null) r.finishHand()
}

function forceFinishResultDisplay(room: PokerRoom) {
  const r = room as unknown as {
    resultKind: 'showdown' | 'fold' | null
    finishHand(): void
  }
  if (r.resultKind !== null) r.finishHand()
}

async function waitForRunoutTimer() {
  await sleep(runoutWait)
  await flushTimers()
}

async function driveThreeWayLockedRunout(room: PokerRoom) {
  await room.sit('a', 0, 200)
  await room.sit('b', 1, 50)
  await room.sit('c', 2, 50)

  for (let i = 0; i < 30; i++) {
    const st = room.snapshot().state
    if (!st || st.board.length > 0 || st.handComplete) return
    if (st.actionSeat === null) return
    const actor = st.players.find((p) => p.seat === st.actionSeat)!
    if (actor.id === 'a') {
      if (st.currentBet < 100) {
        assert.equal(room.applyAction('a', { type: 'raise', total: 100 }), null)
      } else {
        assert.equal(room.applyAction('a', { type: 'call' }), null)
      }
    } else {
      assert.equal(room.applyAction(actor.id, { type: 'all-in' }), null)
    }
  }
}

async function allInAndFinish(room: PokerRoom) {
  const snap = room.snapshot()
  const state = snap.state!
  const first = state.players.find((p) => p.seat === state.actionSeat)!
  const second = state.players.find((p) => p.id !== first.id)!
  assert.equal(room.applyAction(first.id, { type: 'all-in' }), null)
  assert.equal(room.applyAction(second.id, { type: 'call' }), null)

  for (let i = 0; i < 8; i++) {
    const s = room.snapshot()
    if (s.showdownActive) {
      forceFinishShowdown(room)
      return room.snapshot()
    }
    if (!s.handInProgress) return s
    if (s.state?.handComplete) {
      const r = room as unknown as {
        inShowdown: boolean
        finishHand(): void
      }
      if (r.inShowdown) forceFinishShowdown(room)
      else r.finishHand()
      return room.snapshot()
    }
    await flushTimers()
  }
  assert.fail('hand did not finish')
}

function ensureGraceBust(room: PokerRoom, playerId: string) {
  const r = room as unknown as {
    table: unknown
    inShowdown: boolean
    finishHand(): void
    seats: SeatInternal[]
    clearRebuyGrace(seat: number): void
    enterRebuyGraceForZeroStacks(): void
    tryAutoStartNextHandAfterFinish(): void
  }
  const seat = r.seats.findIndex((s) => s?.playerId === playerId)
  assert.notEqual(seat, -1)
  r.seats[seat]!.stack = 0
  r.seats[seat]!.pendingStackAdd = 0

  if (r.inShowdown) r.finishHand()
  else if (r.table) r.finishHand()

  r.clearRebuyGrace(seat)
  r.enterRebuyGraceForZeroStacks()
  r.tryAutoStartNextHandAfterFinish()
}

function bustedInGraceId(room: PokerRoom): string {
  const snap = room.snapshot()
  const seat = snap.seats.find(
    (s) => s && s.stack <= 0 && s.rebuyDeadlineAt,
  )
  assert.ok(seat, 'expected busted player in rebuy grace')
  return seat!.playerId
}

async function bustLoserAllIn(room: PokerRoom, loserId: string) {
  for (let i = 0; i < 80; i++) {
    const st = room.snapshot().state
    if (!st || st.handComplete) break
    if (st.actionSeat === null) break
    const actor = st.players.find((p) => p.seat === st.actionSeat)!
    if (actor.id === loserId) {
      assert.equal(room.applyAction(loserId, { type: 'all-in' }), null)
      continue
    }
    const toCall = st.currentBet - actor.betThisRound
    if (toCall > 0) {
      assert.equal(room.applyAction(actor.id, { type: 'call' }), null)
    } else {
      room.applyAction(actor.id, { type: 'check' })
    }
  }
}

function roomReleasableStack(room: PokerRoom, playerId: string): number {
  return room.youState(playerId).releasableStack
}

function finishHandByFold(room: PokerRoom) {
  const state = room.snapshot().state!
  const first = state.players.find((p) => p.seat === state.actionSeat)!
  const second = state.players.find((p) => p.id !== first.id)!
  if (first.betThisRound < state.currentBet) {
    room.applyAction(first.id, { type: 'call' })
    room.applyAction(second.id, { type: 'fold' })
  } else {
    room.applyAction(first.id, { type: 'fold' })
  }
}

function mintAccountInfo(decimals = 0) {
  const data = Buffer.alloc(MINT_SIZE)
  MintLayout.encode(
    {
      mintAuthorityOption: 0,
      mintAuthority: PublicKey.default,
      supply: 0n,
      decimals,
      isInitialized: true,
      freezeAuthorityOption: 0,
      freezeAuthority: PublicKey.default,
    },
    data,
  )
  return {
    data,
    executable: false,
    lamports: 0,
    owner: TOKEN_PROGRAM_ID,
    rentEpoch: 0,
  }
}

function tableVaultTxResponse(
  idl: Idl,
  user: PublicKey,
  mint: PublicKey,
  instruction: TableVaultIx,
  amount: number,
): VersionedTransactionResponse {
  const coder = new BorshInstructionCoder(idl)
  const data = coder.encode(instruction, { amount: new anchor.BN(amount) })
  const staticAccountKeys = [user, mint, TABLE_VAULT_PROGRAM_ID]
  const accountKeys = {
    staticAccountKeys,
    get: (index: number) => staticAccountKeys[index],
  }
  const message = {
    compiledInstructions: [
      {
        programIdIndex: 2,
        data,
        accountKeyIndexes: [0, 1],
      },
    ],
    getAccountKeys: () => accountKeys,
    isAccountSigner: (index: number) => index === 0,
  }

  return {
    meta: { err: null, innerInstructions: [] },
    transaction: { message },
  } as unknown as VersionedTransactionResponse
}

function retryConnection(responses: (VersionedTransactionResponse | null)[]) {
  let getTransactionCalls = 0
  return {
    connection: {
      getTransaction: async () => {
        getTransactionCalls++
        return responses.shift() ?? null
      },
      getAccountInfo: async () => mintAccountInfo(0),
    },
    calls: () => getTransactionCalls,
  }
}

async function playToFlop(room: PokerRoom) {
  for (let i = 0; i < 60; i++) {
    const st = room.snapshot().state
    if (!st || st.bettingRound === 'flop') return st
    if (st.handComplete || st.actionSeat === null) break
    const p = st.players.find((x) => x.seat === st.actionSeat)
    if (!p) break
    const toCall = st.currentBet - p.betThisRound
    room.applyAction(p.id, toCall > 0 ? { type: 'call' } : { type: 'check' })
  }
  return room.snapshot().state
}

describe('verifyTableVaultTx retry', () => {
  it('passes when a fresh transaction appears on retry', async () => {
    const idl = loadVaultIdl()
    assert.ok(idl)
    const user = Keypair.generate().publicKey
    const mint = Keypair.generate().publicKey
    const tx = tableVaultTxResponse(idl, user, mint, 'lock_for_table', 10)
    const rpc = retryConnection([null, tx])

    const err = await verifyTableVaultTx(
      rpc.connection as never,
      'fresh-lock-signature',
      user,
      mint,
      'lock_for_table',
      10,
    )

    assert.equal(err, null)
    assert.equal(rpc.calls(), 2)
  })

  it('returns not found after all retry attempts are exhausted', async () => {
    const user = Keypair.generate().publicKey
    const mint = Keypair.generate().publicKey
    const rpc = retryConnection([null, null, null, null])

    const err = await verifyTableVaultTx(
      rpc.connection as never,
      'missing-lock-signature',
      user,
      mint,
      'lock_for_table',
      10,
    )

    assert.equal(err, 'Transaction not found or not confirmed')
    assert.equal(rpc.calls(), 4)
  })
})

describe('PokerRoom', () => {
  it('sit, start hand, fold wins', async () => {
    const room = new PokerRoom('test', noTimer)
    assert.equal(await room.sit('a', 0, 500), null)
    assert.equal(await room.sit('b', 1, 500), null)

    const snap = room.snapshot()
    assert.equal(snap.handInProgress, true)
    const state = snap.state!
    const first = state.players.find((p) => p.seat === state.actionSeat)!
    const second = state.players.find((p) => p.id !== first.id)!

    if (first.betThisRound < state.currentBet) {
      assert.equal(room.applyAction(first.id, { type: 'call' }), null)
      assert.equal(room.applyAction(second.id, { type: 'fold' }), null)
    } else {
      assert.equal(room.applyAction(first.id, { type: 'fold' }), null)
    }

    const end = room.snapshot()
    assert.equal(end.handInProgress, true)
    assert.equal(end.state!.handComplete, true)
    assert.equal(end.state!.bettingRound, 'showdown')
    assert.equal(end.showdownActive, false)
    assert.equal(end.resultKind, 'fold')
    assert.equal(end.resultDurationMs, SHOWDOWN_MS)
    assert.ok(end.showdownEndsAt)
    assert.equal(end.state!.winners.length, 1)
    assert.equal(end.state!.winners[0]!.handRank, undefined)
  })

  it('fold result keeps same deadline and per-player operation guards', async () => {
    const room = new PokerRoom('test', noTimer)
    await room.sit('a', 0, 500)
    await room.sit('b', 1, 500)
    await room.sit('c', 2, 300)

    finishHandByFold(room)
    const result = room.snapshot()
    const participant = result.state!.players[0]!.id
    assert.equal(result.resultKind, 'fold')
    assert.equal(result.handInProgress, true)
    assert.equal(result.state!.handComplete, true)
    assert.ok(result.showdownEndsAt)

    await sleep(10)
    const late = room.snapshot()
    assert.equal(late.resultKind, 'fold')
    assert.equal(late.showdownEndsAt, result.showdownEndsAt)
    assert.deepEqual(late.state!.winners, result.state!.winners)

    assert.equal(await room.stand(participant), 'Cannot leave during a hand')
    assert.deepEqual(await room.addChips(participant, 25), {
      appliesFromNextHand: true,
    })
    assert.equal(roomSeats(room).find((s) => s?.playerId === participant)?.pendingStackAdd, 25)

    assert.deepEqual(await room.addChips('c', 50), {
      appliesFromNextHand: true,
    })
    assert.equal(roomSeats(room)[2]?.pendingStackAdd, 50)
    assert.equal(await room.stand('c'), null)
    assert.equal(room.snapshot().seats[2], null)
  })

  it('enters showdown phase with revealed cards', async () => {
    const room = new PokerRoom('test', noTimer)
    await room.sit('a', 0, 200)
    await room.sit('b', 1, 200)

    for (let i = 0; i < 60; i++) {
      const snap = room.snapshot()
      const st = snap.state
      if (!st) break
      if (st.handComplete) {
        assert.equal(snap.showdownActive, true)
        assert.equal(snap.resultKind, 'showdown')
        assert.equal(snap.resultDurationMs, SHOWDOWN_MS)
        assert.ok(snap.showdownEndsAt)
        assert.ok(st.winners.every((w) => w.handRank))
        const revealed = st.players.filter(
          (p) => p.holeCards && p.holeCards.length === 2,
        )
        assert.equal(revealed.length, 2)
        return
      }
      if (st.actionSeat === null) break
      const p = st.players.find((x) => x.seat === st.actionSeat)
      if (!p) break
      const toCall = st.currentBet - p.betThisRound
      room.applyAction(
        p.id,
        toCall > 0 ? { type: 'call' } : { type: 'check' },
      )
    }
    assert.fail('expected showdown')
  })

  it('stand clears seat without vault tx when skip enabled', async () => {
    const room = new PokerRoom('test', noTimer)
    await room.sit('a', 0, 500)
    assert.equal(await room.stand('a'), null)
    assert.equal(room.snapshot().seats[0], null)
  })

  it('checkSit rejects taken seat before lock', async () => {
    const room = new PokerRoom('test', noTimer)
    await room.sit('a', 0, 500)
    assert.equal(room.checkSit('b', 0, 200), 'Seat taken')
    assert.equal(room.checkSit('a', 1, 200), 'Already seated')
  })

  it('busted player enters rebuy grace after hand ends', async () => {
    const room = new PokerRoom('test', fastRebuy)
    await room.sit('a', 0, 500)
    await room.sit('b', 1, 500)

    const end = await allInAndFinish(room)
    const bustedSeat = end.seats.findIndex((s) => s?.stack === 0)
    assert.notEqual(bustedSeat, -1)
    assert.ok(end.seats[bustedSeat])
    assert.ok(end.seats[bustedSeat]!.rebuyDeadlineAt)
    assert.ok(end.seats[bustedSeat]!.rebuyDeadlineAt! > Date.now())
    assert.equal(roomSeats(room)[bustedSeat]?.rebuyDeadlineAt, end.seats[bustedSeat]!.rebuyDeadlineAt)
  })

  it('busted player is removed after rebuy timer expires', async () => {
    const room = new PokerRoom('test', fastRebuy)
    await room.sit('a', 0, 500)
    await room.sit('b', 1, 500)

    const end = await allInAndFinish(room)
    const bustedSeat = end.seats.findIndex(
      (s) => s && s.stack <= 0 && s.rebuyDeadlineAt,
    )
    assert.notEqual(bustedSeat, -1)

    await waitForRebuyTimer()

    assert.equal(room.snapshot().seats[bustedSeat], null)
  })

  it('first sit does not auto-start', async () => {
    const room = new PokerRoom('test', noTimer)
    assert.equal(await room.sit('a', 0, 500), null)
    assert.equal(room.snapshot().handInProgress, false)
    assert.equal(room.snapshot().state, null)
  })

  it('second sit auto-starts hand', async () => {
    const room = new PokerRoom('test', noTimer)
    await room.sit('a', 0, 500)
    assert.equal(await room.sit('b', 1, 500), null)
    const snap = room.snapshot()
    assert.equal(snap.handInProgress, true)
    assert.ok(snap.state)
    assert.notEqual(snap.state!.actionSeat, null)
  })

  it('manual startHand after auto-start rejects duplicate', async () => {
    const room = new PokerRoom('test', noTimer)
    await room.sit('a', 0, 500)
    await room.sit('b', 1, 500)
    assert.equal(room.startHand(), 'Hand already in progress')
  })

  it('third sit allowed while auto-next hand runs', async () => {
    const room = new PokerRoom('test', noTimer)
    await room.sit('a', 0, 500)
    await room.sit('b', 1, 500)
    assert.equal(room.snapshot().handInProgress, true)

    finishHandByFold(room)
    const afterFold = room.snapshot()
    assert.equal(afterFold.handInProgress, true)
    assert.equal(afterFold.state!.handComplete, true)
    assert.equal(afterFold.resultKind, 'fold')
    assert.equal(afterFold.state!.players.length, 2)

    assert.equal(await room.sit('c', 2, 300), null)
    const waiting = room.snapshot()
    assert.equal(waiting.seats[2]?.playerId, 'c')
    assert.equal(waiting.seats[2]?.stack, 300)
    assert.equal(waiting.state!.players.find((p) => p.id === 'c'), undefined)
    assert.equal(waiting.state!.players.length, 2)
  })

  it('auto-starts next hand after fold with two seated', async () => {
    const room = new PokerRoom('test', noTimer)
    await room.sit('a', 0, 500)
    await room.sit('b', 1, 500)

    finishHandByFold(room)

    const result = room.snapshot()
    assert.equal(result.handInProgress, true)
    assert.equal(result.state!.handComplete, true)
    assert.equal(result.resultKind, 'fold')

    forceFinishResultDisplay(room)

    const snap = room.snapshot()
    assert.equal(snap.handInProgress, true)
    assert.equal(snap.state!.handComplete, false)
    assert.equal(snap.state!.bettingRound, 'preflop')
    assert.notEqual(snap.state!.actionSeat, null)
  })

  it('does not auto-start next hand when one seated remains', async () => {
    const room = new PokerRoom('test', fastRebuy)
    await room.sit('a', 0, 500)
    await room.sit('b', 1, 500)

    const end = await allInAndFinish(room)
    assert.equal(end.seats.filter(Boolean).length, 2)
    assert.equal(end.seats.filter((s) => s && s.stack > 0).length, 1)
    assert.equal(end.handInProgress, false)
    assert.equal(end.state, null)
  })

  it('manual startHand after auto-next rejects duplicate', async () => {
    const room = new PokerRoom('test', noTimer)
    await room.sit('a', 0, 500)
    await room.sit('b', 1, 500)
    finishHandByFold(room)
    forceFinishResultDisplay(room)
    assert.equal(room.snapshot().handInProgress, true)
    assert.equal(room.startHand(), 'Hand already in progress')
  })

  it('failed sit does not auto-start', async () => {
    const room = new PokerRoom('test', noTimer)
    await room.sit('a', 0, 500)
    assert.equal(room.snapshot().handInProgress, false)

    assert.notEqual(await room.sit('b', 0, 200), null)
    assert.equal(room.snapshot().handInProgress, false)

    assert.notEqual(await room.sit('a', 1, 200), null)
    assert.equal(room.snapshot().handInProgress, false)
    assert.equal(room.snapshot().seats.filter(Boolean).length, 1)
  })
})

describe('PokerRoom waiting sit', () => {
  it('allows sit during active hand without joining current HoldemTable', async () => {
    const room = new PokerRoom('test', noTimer)
    await room.sit('a', 0, 500)
    await room.sit('b', 1, 500)
    assert.equal(room.snapshot().handInProgress, true)

    assert.equal(await room.sit('c', 2, 300), null)
    const snap = room.snapshot()
    assert.equal(snap.seats[2]?.playerId, 'c')
    assert.equal(snap.seats[2]?.stack, 300)
    assert.equal(snap.state!.players.length, 2)
    assert.equal(snap.state!.players.find((p) => p.id === 'c'), undefined)
  })

  it('youState for waiting player has seat but no cards or action', async () => {
    const room = new PokerRoom('test', noTimer)
    await room.sit('a', 0, 500)
    await room.sit('b', 1, 500)
    assert.equal(await room.sit('c', 2, 300), null)

    const you = room.youState('c')
    assert.equal(you.seat, 2)
    assert.equal(you.holeCards, null)
    assert.equal(you.canAct, false)
    assert.equal(you.toCall, 0)
    assert.equal(you.rebuyDeadlineAt, null)
  })

  it('waiting player enters next hand after auto-next', async () => {
    const room = new PokerRoom('test', noTimer)
    await room.sit('a', 0, 500)
    await room.sit('b', 1, 500)
    assert.equal(await room.sit('c', 2, 300), null)

    finishHandByFold(room)
    const result = room.snapshot()
    assert.equal(result.resultKind, 'fold')
    assert.equal(result.state!.players.find((p) => p.id === 'c'), undefined)

    forceFinishResultDisplay(room)

    const snap = room.snapshot()
    assert.equal(snap.handInProgress, true)
    assert.equal(snap.state!.players.length, 3)
    assert.ok(snap.state!.players.find((p) => p.id === 'c'))
  })

  it('third sit mid-hand does not change current hand player count', async () => {
    const room = new PokerRoom('test', noTimer)
    await room.sit('a', 0, 500)
    await room.sit('b', 1, 500)
    assert.equal(room.snapshot().state!.players.length, 2)

    assert.equal(await room.sit('c', 2, 300), null)
    assert.equal(room.snapshot().state!.players.length, 2)
    assert.equal(room.snapshot().handInProgress, true)
  })

  it('checkSit rejects taken seat and already seated during active hand', async () => {
    const room = new PokerRoom('test', noTimer)
    await room.sit('a', 0, 500)
    await room.sit('b', 1, 500)
    assert.equal(room.snapshot().handInProgress, true)

    assert.equal(room.checkSit('d', 0, 200), 'Seat taken')
    assert.equal(room.checkSit('a', 2, 200), 'Already seated')
  })

  it('allows sit during showdown display without joining current hand', async () => {
    const room = new PokerRoom('test', noTimer)
    await room.sit('a', 0, 200)
    await room.sit('b', 1, 200)

    for (let i = 0; i < 60; i++) {
      const snap = room.snapshot()
      const st = snap.state
      if (!st) break
      if (st.handComplete && snap.showdownActive) {
        assert.equal(await room.sit('c', 2, 300), null)
        const waiting = room.snapshot()
        assert.equal(waiting.seats[2]?.playerId, 'c')
        assert.equal(waiting.state!.players.find((p) => p.id === 'c'), undefined)
        assert.equal(waiting.showdownActive, true)
        return
      }
      if (st.actionSeat === null) break
      const p = st.players.find((x) => x.seat === st.actionSeat)
      if (!p) break
      const toCall = st.currentBet - p.betThisRound
      room.applyAction(
        p.id,
        toCall > 0 ? { type: 'call' } : { type: 'check' },
      )
    }
    assert.fail('expected showdown')
  })

  it('rejects applyAction from waiting player', async () => {
    const room = new PokerRoom('test', noTimer)
    await room.sit('a', 0, 500)
    await room.sit('b', 1, 500)
    assert.equal(await room.sit('c', 2, 300), null)

    assert.notEqual(room.applyAction('c', { type: 'fold' }), null)
  })
})

describe('PokerRoom action timeout', () => {
  it('auto-checks when toCall is 0 and timeout expires', async () => {
    const room = new PokerRoom('test', fastTimer)
    try {
      await room.sit('a', 0, 500)
      await room.sit('b', 1, 500)

      const flop = await playToFlop(room)
      assert.ok(flop)
      assert.equal(flop!.bettingRound, 'flop')

      const st = room.snapshot().state!
      const actor = st.players.find((p) => p.seat === st.actionSeat)!
      assert.equal(st.currentBet - actor.betThisRound, 0)

      const seatBefore = st.actionSeat
      await waitForActionTimer()

      const after = room.snapshot().state!
      const actorAfter = after.players.find((p) => p.seat === seatBefore)!
      assert.notEqual(actorAfter.status, 'folded')
      assert.ok(
        after.actionSeat !== seatBefore ||
          after.bettingRound !== 'flop' ||
          after.handComplete,
      )
    } finally {
      stopRoomTimer(room)
    }
  })

  it('auto-folds when toCall is positive and timeout expires', async () => {
    const room = new PokerRoom('test', fastTimer)
    try {
      await room.sit('a', 0, 500)
      await room.sit('b', 1, 500)

      const st = room.snapshot().state!
      const seatBefore = st.actionSeat!
      const actor = st.players.find((p) => p.seat === seatBefore)!
      assert.ok(st.currentBet - actor.betThisRound > 0)

      await waitUntilActionSeatChanges(room, seatBefore)

      const after = room.snapshot().state!
      assert.notEqual(after.actionSeat, seatBefore)
    } finally {
      stopRoomTimer(room)
    }
  })

  it('resets timer after manual action', async () => {
    const room = new PokerRoom('test', fastTimer)
    try {
      await room.sit('a', 0, 500)
      await room.sit('b', 1, 500)

      await sleep(5)
      const st = room.snapshot().state!
      const actor = st.players.find((p) => p.seat === st.actionSeat)!
      const toCall = st.currentBet - actor.betThisRound
      assert.equal(
        room.applyAction(
          actor.id,
          toCall > 0 ? { type: 'call' } : { type: 'check' },
        ),
        null,
      )

      const mid = room.snapshot().state!
      const nextActor = mid.players.find((p) => p.seat === mid.actionSeat)!
      assert.notEqual(nextActor.id, actor.id)
      assert.notEqual(nextActor.status, 'folded')

      await waitForActionTimer()

      const after = room.snapshot().state!
      const original = after.players.find((p) => p.id === actor.id)!
      assert.notEqual(original.status, 'folded')
    } finally {
      stopRoomTimer(room)
    }
  })

  it('clears timer when hand ends by fold', async () => {
    const room = new PokerRoom('test', fastTimer)
    try {
      await room.sit('a', 0, 500)
      await room.sit('b', 1, 500)

      finishHandByFold(room)
      assert.equal(room.snapshot().handInProgress, true)
      assert.equal(room.snapshot().state!.handComplete, true)
      assert.equal(room.snapshot().resultKind, 'fold')

      await waitForActionTimer()

      const after = room.snapshot()
      assert.equal(after.handInProgress, true)
      assert.equal(after.state!.handComplete, true)
      assert.equal(after.resultKind, 'fold')
      assert.equal(after.state!.actionSeat, null)
    } finally {
      stopRoomTimer(room)
    }
  })

  it('does not act during showdown display', async () => {
    const room = new PokerRoom('test', fastTimer)
    try {
      await room.sit('a', 0, 200)
      await room.sit('b', 1, 200)

      for (let i = 0; i < 60; i++) {
        const snap = room.snapshot()
        const st = snap.state
        if (!st) break
        if (st.handComplete) {
          assert.equal(snap.showdownActive, true)
          assert.equal(snap.resultKind, 'showdown')
          await waitForActionTimer()
          const still = room.snapshot()
          assert.equal(still.showdownActive, true)
          assert.equal(still.resultKind, 'showdown')
          assert.equal(still.state!.handComplete, true)
          return
        }
        if (st.actionSeat === null) break
        const p = st.players.find((x) => x.seat === st.actionSeat)
        if (!p) break
        const toCall = st.currentBet - p.betThisRound
        room.applyAction(
          p.id,
          toCall > 0 ? { type: 'call' } : { type: 'check' },
        )
      }
      assert.fail('expected showdown')
    } finally {
      stopRoomTimer(room)
    }
  })

  it('auto-start and auto-next still work with action timer enabled', async () => {
    const room = new PokerRoom('test', fastTimer)
    try {
      await room.sit('a', 0, 500)
      assert.equal(room.snapshot().handInProgress, false)

      await room.sit('b', 1, 500)
      assert.equal(room.snapshot().handInProgress, true)
      assert.notEqual(room.snapshot().state!.actionSeat, null)

      finishHandByFold(room)
      const result = room.snapshot()
      assert.equal(result.handInProgress, true)
      assert.equal(result.state!.handComplete, true)
      assert.equal(result.resultKind, 'fold')

      forceFinishResultDisplay(room)

      const snap = room.snapshot()
      assert.equal(snap.handInProgress, true)
      assert.equal(snap.state!.handComplete, false)
      assert.equal(snap.state!.bettingRound, 'preflop')
      assert.notEqual(snap.state!.actionSeat, null)
    } finally {
      stopRoomTimer(room)
    }
  })

  it('does not double-act when player already acted manually', async () => {
    const room = new PokerRoom('test', fastTimer)
    try {
      await room.sit('a', 0, 500)
      await room.sit('b', 1, 500)

      await sleep(5)
      const st = room.snapshot().state!
      const actor = st.players.find((p) => p.seat === st.actionSeat)!
      const toCall = st.currentBet - actor.betThisRound
      assert.equal(
        room.applyAction(
          actor.id,
          toCall > 0 ? { type: 'call' } : { type: 'check' },
        ),
        null,
      )

      const mid = room.snapshot().state!
      const stacksAfterManual = mid.players.map((p) => ({
        id: p.id,
        stack: p.stack,
        status: p.status,
      }))

      await sleep(timerWait * 2)
      await flushTimers()

      const after = room.snapshot().state!
      for (const before of stacksAfterManual) {
        const now = after.players.find((p) => p.id === before.id)!
        if (before.id === actor.id) {
          assert.notEqual(now.status, 'folded')
        }
        assert.equal(now.stack, before.stack)
        assert.equal(now.status, before.status)
      }
    } finally {
      stopRoomTimer(room)
    }
  })

  it('stale seq guard ignores superseded timeout callback', async () => {
    const room = new PokerRoom('test', fastTimer)
    try {
      await room.sit('a', 0, 500)
      await room.sit('b', 1, 500)

      const st = room.snapshot().state!
      const actor = st.players.find((p) => p.seat === st.actionSeat)!
      assert.ok(st.currentBet - actor.betThisRound > 0)

      await sleep(5)
      assert.equal(room.applyAction(actor.id, { type: 'call' }), null)

      const mid = room.snapshot().state!
      const actorAfterCall = mid.players.find((p) => p.id === actor.id)!
      assert.notEqual(actorAfterCall.status, 'folded')

      await waitForActionTimer()

      const after = room.snapshot().state!
      const actorFinal = after.players.find((p) => p.id === actor.id)!
      assert.notEqual(actorFinal.status, 'folded')
    } finally {
      stopRoomTimer(room)
    }
  })
})

describe('PokerRoom add chips', () => {
  it('addChips when no hand increases stack immediately', async () => {
    const room = new PokerRoom('test', noTimer)
    await room.sit('a', 0, 500)
    assert.deepEqual(await room.addChips('a', 100), {
      appliesFromNextHand: false,
    })
    assert.equal(room.snapshot().seats[0]?.stack, 600)
    assert.equal(roomSeats(room)[0]?.pendingStackAdd, 0)
  })

  it('addChips during active hand does not change engine stack', async () => {
    const room = new PokerRoom('test', noTimer)
    await room.sit('a', 0, 500)
    await room.sit('b', 1, 500)
    const stackBefore = room.snapshot().state!.players.find((p) => p.id === 'a')!
      .stack
    assert.deepEqual(await room.addChips('a', 100), {
      appliesFromNextHand: true,
    })
    const stackAfter = room.snapshot().state!.players.find((p) => p.id === 'a')!
      .stack
    assert.equal(stackAfter, stackBefore)
    assert.equal(roomSeats(room)[0]?.pendingStackAdd, 100)
  })

  it('pending add applies on next hand after finishHand', async () => {
    const room = new PokerRoom('test', noTimer)
    await room.sit('a', 0, 500)
    await room.sit('b', 1, 500)
    assert.deepEqual(await room.addChips('a', 100), {
      appliesFromNextHand: true,
    })
    finishHandByFold(room)
    assert.equal(room.snapshot().resultKind, 'fold')
    assert.equal(roomSeats(room)[0]?.pendingStackAdd, 100)
    forceFinishResultDisplay(room)
    const snap = room.snapshot()
    assert.equal(snap.handInProgress, true)
    const aInHand = snap.state!.players.find((p) => p.id === 'a')!
    assert.ok(aInHand.stack >= 500 + 100 - 20)
  })

  it('two addChips during same hand accumulate pending', async () => {
    const room = new PokerRoom('test', noTimer)
    await room.sit('a', 0, 500)
    await room.sit('b', 1, 500)
    await room.addChips('a', 50)
    await room.addChips('a', 75)
    assert.equal(roomSeats(room)[0]?.pendingStackAdd, 125)
    const engineStack = room.snapshot().state!.players.find((p) => p.id === 'a')!
      .stack
    assert.ok(engineStack < 500)
  })

  it('applyPendingStackAdds is idempotent', async () => {
    const room = new PokerRoom('test', noTimer)
    await room.sit('a', 0, 500)
    await room.sit('b', 1, 500)
    await room.addChips('a', 100)
    applyPendingStackAdds(room)
    assert.equal(roomSeats(room)[0]?.stack, 600)
    assert.equal(roomSeats(room)[0]?.pendingStackAdd, 0)
    applyPendingStackAdds(room)
    assert.equal(roomSeats(room)[0]?.stack, 600)
    assert.equal(roomSeats(room)[0]?.pendingStackAdd, 0)
  })

  it('checkAddChips rejects invalid cases', async () => {
    const room = new PokerRoom('test', noTimer)
    assert.equal(room.checkAddChips('a', 100), 'Not seated')
    await room.sit('a', 0, 500)
    assert.equal(room.checkAddChips('a', 0), 'amount must be positive')
    assert.equal(room.checkAddChips('a', -5), 'amount must be positive')
    assert.equal(room.checkAddChips('a', 1.5), 'amount must be positive')
  })

  it('busted player with pending add stays seated after hand', async () => {
    const room = new PokerRoom('test', noTimer)
    await room.sit('a', 0, 100)
    await room.sit('b', 1, 500)
    assert.deepEqual(await room.addChips('a', 200), {
      appliesFromNextHand: true,
    })
    await bustLoserAllIn(room, 'a')
    forceFinishShowdown(room)
    const seated = room.snapshot().seats[0]
    assert.ok(seated)
    assert.equal(seated!.playerId, 'a')
    assert.ok(seated!.stack > 0)
    assert.equal(roomSeats(room)[0]?.pendingStackAdd, 0)
  })

  it('syncStacksFromTable preserves pendingStackAdd', async () => {
    const room = new PokerRoom('test', noTimer)
    await room.sit('a', 0, 500)
    await room.sit('b', 1, 500)
    await room.addChips('a', 80)
    finishHandByFold(room)
    assert.equal(roomSeats(room)[0]?.pendingStackAdd, 80)
    forceFinishResultDisplay(room)
    assert.equal(roomSeats(room)[0]?.pendingStackAdd, 0)
    assert.ok(roomSeats(room)[0]!.stack > 0)
  })

  it('snapshot seats expose only public fields', async () => {
    const room = new PokerRoom('test', noTimer)
    await room.sit('a', 0, 500)
    await room.sit('b', 1, 500)
    await room.addChips('a', 100)
    const snap = room.snapshot()
    for (const seat of snap.seats) {
      if (!seat) continue
      const keys = Object.keys(seat).sort().join(',')
      assert.ok(
        keys === 'playerId,stack' || keys === 'playerId,rebuyDeadlineAt,stack',
      )
    }
  })

  it('waiting player addChips during hand enters next hand with top-up', async () => {
    const room = new PokerRoom('test', noTimer)
    await room.sit('a', 0, 500)
    await room.sit('b', 1, 500)
    await room.sit('c', 2, 300)
    assert.deepEqual(await room.addChips('c', 100), {
      appliesFromNextHand: true,
    })
    assert.equal(roomSeats(room)[2]?.pendingStackAdd, 100)
    finishHandByFold(room)
    assert.equal(room.snapshot().resultKind, 'fold')
    assert.equal(roomSeats(room)[2]?.pendingStackAdd, 100)
    forceFinishResultDisplay(room)
    const snap = room.snapshot()
    const c = snap.state!.players.find((p) => p.id === 'c')
    assert.ok(c)
    assert.ok(c!.stack >= 400 - 20)
  })
})

describe('PokerRoom releasableStack stand', () => {
  it('T1: waiting sit + add-chips during hand + stand includes pendingStackAdd', async () => {
    const room = new PokerRoom('test', noTimer)
    await room.sit('a', 0, 500)
    await room.sit('b', 1, 500)
    assert.equal(room.snapshot().handInProgress, true)

    assert.equal(await room.sit('c', 2, 300), null)
    assert.deepEqual(await room.addChips('c', 100), {
      appliesFromNextHand: true,
    })
    assert.equal(roomSeats(room)[2]?.pendingStackAdd, 100)
    assert.equal(roomSeats(room)[2]?.stack, 300)

    assert.equal(roomReleasableStack(room, 'c'), 400)
    assert.equal(await room.stand('c'), null)
    assert.equal(room.snapshot().seats[2], null)
  })

  it('T2: stand without pending uses stack only', async () => {
    const room = new PokerRoom('test', noTimer)
    await room.sit('a', 0, 500)
    assert.equal(room.snapshot().handInProgress, false)
    assert.equal(roomSeats(room)[0]?.pendingStackAdd, 0)
    assert.equal(roomReleasableStack(room, 'a'), 500)
    assert.equal(await room.stand('a'), null)
    assert.equal(room.snapshot().seats[0], null)
  })

  it('T3: add-chips between hands then releasable equals stack', async () => {
    const room = new PokerRoom('test', noTimer)
    await room.sit('a', 0, 500)
    assert.equal(room.snapshot().handInProgress, false)

    assert.deepEqual(await room.addChips('a', 100), {
      appliesFromNextHand: false,
    })
    assert.equal(roomSeats(room)[0]?.pendingStackAdd, 0)
    assert.equal(roomSeats(room)[0]?.stack, 600)
    assert.equal(roomReleasableStack(room, 'a'), 600)
    assert.equal(await room.stand('a'), null)
  })

  it('T4: HU largest stack releasableStack after all-in matches seat stack', async () => {
    const room = new PokerRoom('test', noTimer)
    await room.sit('a', 0, 500)
    await room.sit('b', 1, 500)
    await allInAndFinish(room)
    const end = room.snapshot()
    const richest = end.seats
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => b.stack - a.stack)[0]
    assert.ok(richest)
    assert.ok(richest.stack >= 500)
    assert.equal(roomReleasableStack(room, richest.playerId), richest.stack)
  })

  it('T5: busted loser releasableStack is zero', async () => {
    const room = new PokerRoom('test', fastRebuy)
    await room.sit('a', 0, 500)
    await room.sit('b', 1, 500)
    const end = await allInAndFinish(room)
    const busted = end.seats.find((s) => s && s.stack === 0)
    assert.ok(busted)
    assert.equal(roomReleasableStack(room, busted!.playerId), 0)
    assert.equal(await room.stand(busted!.playerId), null)
  })
})

describe('PokerRoom rebuy grace', () => {
  async function bustOnePlayer(room: PokerRoom) {
    return allInAndFinish(room)
  }

  it('grace deadline is approximately now + rebuyGraceMs', async () => {
    const room = new PokerRoom('test', fastRebuy)
    await room.sit('a', 0, 500)
    await room.sit('b', 1, 500)
    const before = Date.now()
    await bustOnePlayer(room)
    const busted = room.snapshot().seats.find(
      (s) => s && s.stack <= 0 && s.rebuyDeadlineAt,
    )
    assert.ok(busted?.rebuyDeadlineAt)
    const delta = busted!.rebuyDeadlineAt! - before
    assert.ok(delta >= fastRebuy.rebuyGraceMs! - 20)
    assert.ok(delta <= fastRebuy.rebuyGraceMs! + 200)
  })

  it('rebuy before expiry keeps player seated with cleared grace', async () => {
    const room = new PokerRoom('test', { actionTimeoutMs: 0, rebuyGraceMs: 1000 })
    await room.sit('a', 0, 500)
    await room.sit('b', 1, 500)
    await bustOnePlayer(room)
    const bustedId = bustedInGraceId(room)
    assert.deepEqual(await room.addChips(bustedId, 200), {
      appliesFromNextHand: false,
    })
    const after = room.snapshot()
    const seat = after.seats.find((s) => s?.playerId === bustedId)
    assert.ok(seat)
    assert.ok(seat!.stack > 0)
    assert.equal(seat!.rebuyDeadlineAt ?? null, null)
    assert.equal(roomSeats(room).find((s) => s?.playerId === bustedId)?.rebuyDeadlineAt, null)
  })

  it('player with zero stack in grace is excluded from startHand players', async () => {
    const room = new PokerRoom('test', fastRebuy)
    await room.sit('b', 1, 500)
    await room.sit('c', 2, 500)
    await room.sit('a', 0, 500)
    ensureGraceBust(room, 'a')
    const snap = room.snapshot()
    assert.equal(snap.seats[0]?.stack, 0)
    assert.ok(snap.seats[0]?.rebuyDeadlineAt)
    assert.equal(snap.handInProgress, true)
    assert.equal(snap.state!.players.length, 2)
    assert.equal(snap.state!.players.find((p) => p.id === 'a'), undefined)
  })

  it('does not auto-start when only one eligible player', async () => {
    const room = new PokerRoom('test', fastRebuy)
    await room.sit('a', 0, 500)
    await room.sit('b', 1, 500)
    await bustOnePlayer(room)
    const end = room.snapshot()
    assert.equal(end.seats.filter(Boolean).length, 2)
    assert.equal(end.seats.filter((s) => s && s.stack > 0).length, 1)
    assert.equal(end.handInProgress, false)
  })

  it('three players bust one continues hand without busted player', async () => {
    const room = new PokerRoom('test', fastRebuy)
    await room.sit('b', 1, 500)
    await room.sit('c', 2, 500)
    await room.sit('a', 0, 500)
    ensureGraceBust(room, 'a')
    const end = room.snapshot()
    assert.equal(end.seats[0]?.playerId, 'a')
    assert.equal(end.seats[0]?.stack, 0)
    assert.ok(end.seats[0]?.rebuyDeadlineAt)
    assert.equal(end.handInProgress, true)
    assert.equal(end.state!.players.length, 2)
    assert.equal(end.state!.players.find((p) => p.id === 'a'), undefined)
  })

  it('rebuy addChips during others hand applies immediately', async () => {
    const room = new PokerRoom('test', fastRebuy)
    await room.sit('b', 1, 500)
    await room.sit('c', 2, 500)
    await room.sit('a', 0, 500)
    ensureGraceBust(room, 'a')
    assert.equal(room.snapshot().handInProgress, true)

    assert.deepEqual(await room.addChips('a', 150), {
      appliesFromNextHand: false,
    })
    assert.equal(roomSeats(room)[0]?.stack, 150)
    assert.equal(roomSeats(room)[0]?.rebuyDeadlineAt, null)
    assert.equal(roomSeats(room)[0]?.pendingStackAdd, 0)

    await waitForRebuyTimer()
    assert.equal(room.snapshot().seats[0]?.playerId, 'a')
  })

  it('stand during grace clears seat without hand block', async () => {
    const room = new PokerRoom('test', fastRebuy)
    await room.sit('b', 1, 500)
    await room.sit('c', 2, 500)
    await room.sit('a', 0, 500)
    ensureGraceBust(room, 'a')
    assert.equal(room.snapshot().handInProgress, true)

    assert.equal(await room.stand('a'), null)
    assert.equal(room.snapshot().seats[0], null)
    assert.equal(roomSeats(room)[0], null)
  })

  it('youState exposes rebuyDeadlineAt for busted player', async () => {
    const room = new PokerRoom('test', { actionTimeoutMs: 0, rebuyGraceMs: 1000 })
    await room.sit('a', 0, 500)
    await room.sit('b', 1, 500)
    await bustOnePlayer(room)
    const bustedId = bustedInGraceId(room)
    const you = room.youState(bustedId)
    assert.ok(you.rebuyDeadlineAt)
    assert.ok(you.rebuyDeadlineAt! > Date.now())
  })

  it('timer does not kick player with stack after rebuy', async () => {
    const room = new PokerRoom('test', fastRebuy)
    await room.sit('a', 0, 500)
    await room.sit('b', 1, 500)
    await bustOnePlayer(room)
    const bustedId = bustedInGraceId(room)
    await room.addChips(bustedId, 100)
    await waitForRebuyTimer()
    const seat = room.snapshot().seats.find((s) => s?.playerId === bustedId)
    assert.ok(seat)
    assert.ok(seat!.stack > 0)
  })

  it('rebuy success with two eligible may auto-start next hand', async () => {
    const room = new PokerRoom('test', fastRebuy)
    await room.sit('a', 0, 500)
    await room.sit('b', 1, 500)
    await bustOnePlayer(room)
    const bustedId = bustedInGraceId(room)
    assert.equal(room.snapshot().handInProgress, false)
    await room.addChips(bustedId, 200)
    const after = room.snapshot()
    assert.equal(after.handInProgress, true)
    assert.equal(after.state!.players.length, 2)
  })

  it('pendingStackAdd before grace prevents grace entry', async () => {
    const room = new PokerRoom('test', fastRebuy)
    await room.sit('a', 0, 100)
    await room.sit('b', 1, 500)
    await room.addChips('a', 200)
    await bustLoserAllIn(room, 'a')
    forceFinishShowdown(room)
    const seated = room.snapshot().seats[0]
    assert.ok(seated)
    assert.ok(seated!.stack > 0)
    assert.equal(seated!.rebuyDeadlineAt ?? null, null)
  })
})

describe('PokerRoom locked runout', () => {
  it('staged runout broadcasts board growth 3 to 4 to 5', async () => {
    const room = new PokerRoom('test', fastRunout)
    const seenBoardLengths = new Set<number>()
    const snapshots: RoomSnapshot[] = []
    room.onTableUpdate = () => {
      const snap = room.snapshot()
      snapshots.push(snap)
      const len = snap.state?.board.length ?? 0
      if (len > 0) seenBoardLengths.add(len)
    }

    await driveThreeWayLockedRunout(room)
    seenBoardLengths.add(room.snapshot().state!.board.length)

    await waitForRunoutTimer()
    await waitForRunoutTimer()

    if (room.snapshot().resultKind === null) {
      assert.fail('resultKind still null after 2× waitForRunoutTimer')
    }

    assert.ok(seenBoardLengths.has(3))
    assert.ok(seenBoardLengths.has(4))
    assert.ok(seenBoardLengths.has(5))

    const board5Emits = snapshots.filter((s) => s.state?.board.length === 5)
    assert.equal(board5Emits.length, 1)

    const terminal = board5Emits[0]!
    assert.equal(terminal.state!.handComplete, true)
    assert.equal(terminal.resultKind, 'showdown')
    assert.ok(terminal.showdownEndsAt)
    assert.equal(terminal.resultDurationMs, SHOWDOWN_MS)
    assert.ok(terminal.state!.winners.length >= 1)
    assert.ok(terminal.state!.winners.every((w) => w.handRank))

    for (const snap of snapshots) {
      if (snap.state?.handComplete) {
        assert.notEqual(snap.resultKind, null)
        assert.ok(snap.showdownEndsAt)
        assert.equal(snap.resultDurationMs, SHOWDOWN_MS)
      }
    }

    const result = room.snapshot()
    assert.equal(result.resultKind, 'showdown')
    assert.ok(result.showdownEndsAt)
    assert.equal(room.youState('a').canAct, false)

    forceFinishResultDisplay(room)
  })

  it('you.canAct is false for lone active player during runout', async () => {
    const room = new PokerRoom('test', fastRunout)
    await driveThreeWayLockedRunout(room)

    const snap = room.snapshot().state!
    assert.equal(snap.actionSeat, null)
    assert.equal(snap.board.length, 3)

    const you = room.youState('a')
    assert.equal(you.canAct, false)
  })

  it('rejects applyAction from lone active player during runout', async () => {
    const room = new PokerRoom('test', fastRunout)
    await driveThreeWayLockedRunout(room)

    assert.equal(room.snapshot().state!.board.length, 3)
    assert.notEqual(room.applyAction('a', { type: 'fold' }), null)
  })
})
