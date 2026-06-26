import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createDeck, HoldemTable, parseCards } from './index.js'
import type { Card } from './types.js'

function fixedShuffle(cards: Card[]): Card[] {
  return cards
}

function riggedShuffle(cardText: string): (cards: Card[]) => Card[] {
  const front = parseCards(cardText)
  return (cards: Card[]) => {
    const used = new Set(front.map((c) => `${c.rank}${c.suit}`))
    return [...front, ...cards.filter((c) => !used.has(`${c.rank}${c.suit}`))]
  }
}

function act(
  table: HoldemTable,
  id: string,
  action: Parameters<HoldemTable['applyAction']>[1],
) {
  const r = table.applyAction(id, action)
  assert.equal(r.ok, true, r.error)
  return r
}

function assertValidCheckAction(
  table: HoldemTable,
  allInButtonId: string,
  expectedRound: string,
) {
  const s = table.getState()
  assert.equal(s.bettingRound, expectedRound)
  assert.notEqual(s.actionSeat, null)
  const actor = s.players.find((p) => p.seat === s.actionSeat)!
  const allInButton = s.players.find((p) => p.id === allInButtonId)!
  assert.equal(allInButton.status, 'all-in')
  assert.equal(allInButton.stack, 0)
  assert.notEqual(actor.id, allInButtonId)
  assert.notEqual(actor.status, 'folded')
  assert.notEqual(actor.status, 'all-in')
  assert.equal(actor.status, 'active')
  assert.ok(actor.stack > 0)
  assert.equal(s.currentBet - actor.betThisRound, 0)
  act(table, actor.id, { type: 'check' })
}

function driveAllInButtonToFlop(table: HoldemTable, deepIds: Set<string>) {
  table.startHand()
  for (let i = 0; i < 80; i++) {
    const s = table.getState()
    if (s.bettingRound !== 'preflop' || s.handComplete || s.actionSeat === null) {
      return
    }
    const actor = s.players.find((p) => p.seat === s.actionSeat)!
    const toCall = s.currentBet - actor.betThisRound
    if (deepIds.has(actor.id)) {
      if (toCall > 0) act(table, actor.id, { type: 'call' })
      else act(table, actor.id, { type: 'check' })
    } else {
      act(table, actor.id, { type: 'all-in' })
    }
  }
}

function threeWayLockedRunoutTable() {
  return new HoldemTable({
    players: [
      { id: 'a', seat: 0, stack: 200 },
      { id: 'b', seat: 1, stack: 50 },
      { id: 'c', seat: 2, stack: 50 },
    ],
    smallBlind: 5,
    bigBlind: 10,
    buttonSeat: 0,
    shuffle: () => createDeck(),
  })
}

function driveThreeWayLockedRunout(table: HoldemTable) {
  table.startHand()
  for (let i = 0; i < 20; i++) {
    const s = table.getState()
    if (s.board.length > 0 || s.handComplete) return
    if (s.actionSeat === null) return
    const actor = s.players.find((p) => p.seat === s.actionSeat)!
    if (actor.id === 'a') {
      if (s.currentBet < 100) {
        act(table, 'a', { type: 'raise', total: 100 })
      } else {
        act(table, 'a', { type: 'call' })
      }
    } else {
      act(table, actor.id, { type: 'all-in' })
    }
  }
}

function nWayLockedRunoutTable(n: number) {
  return new HoldemTable({
    players: [
      { id: 'deep', seat: 0, stack: 200 },
      ...Array.from({ length: n - 1 }, (_, i) => ({
        id: `s${i}`,
        seat: i + 1,
        stack: 50,
      })),
    ],
    smallBlind: 5,
    bigBlind: 10,
    buttonSeat: 0,
    shuffle: () => createDeck(),
  })
}

function driveLockedRunout(table: HoldemTable) {
  table.startHand()
  for (let i = 0; i < 80; i++) {
    const s = table.getState()
    if (s.board.length > 0 || s.handComplete) return
    if (s.actionSeat === null) return
    const actor = s.players.find((p) => p.seat === s.actionSeat)!
    if (actor.id === 'deep') {
      if (s.currentBet < 100) {
        act(table, 'deep', { type: 'raise', total: 100 })
      } else {
        act(table, 'deep', { type: 'call' })
      }
    } else {
      act(table, actor.id, { type: 'all-in' })
    }
  }
}

function driveCheckCallToCompletion(table: HoldemTable) {
  for (let step = 0; step < 60; step++) {
    const s = table.getState()
    if (s.handComplete) return
    if (s.actionSeat === null) return
    const actor = s.players.find((p) => p.seat === s.actionSeat)!
    const toCall = s.currentBet - actor.betThisRound
    if (toCall > 0 && actor.stack >= toCall) {
      act(table, actor.id, { type: 'call' })
    } else if (toCall === 0) {
      act(table, actor.id, { type: 'check' })
    } else {
      act(table, actor.id, { type: 'all-in' })
    }
  }
}

function driveThreeWaySidePotAllIn(table: HoldemTable) {
  table.startHand()
  for (let i = 0; i < 30; i++) {
    const s = table.getState()
    if (s.board.length > 0 || s.handComplete || s.actionSeat === null) break
    const actor = s.players.find((p) => p.seat === s.actionSeat)!
    const toCall = s.currentBet - actor.betThisRound
    if (actor.id === 'A') {
      if (s.currentBet < 100) {
        act(table, 'A', { type: 'raise', total: 100 })
      } else if (toCall > 0) {
        act(table, 'A', { type: 'call' })
      } else {
        act(table, 'A', { type: 'check' })
      }
    } else {
      act(table, actor.id, { type: 'all-in' })
    }
  }
  while (table.isRunoutPending()) {
    const r = table.advanceRunout()
    assert.equal(r.ok, true, r.error)
  }
}

describe('HoldemTable', () => {
  it('posts blinds and deals hole cards', () => {
    const table = new HoldemTable({
      players: [
        { id: 'a', seat: 0, stack: 1000 },
        { id: 'b', seat: 3, stack: 1000 },
      ],
      smallBlind: 5,
      bigBlind: 10,
      shuffle: fixedShuffle,
    })
    const r = table.startHand()
    assert.equal(r.ok, true)
    const s = table.getStateForPlayer('a')
    assert.equal(s.bettingRound, 'preflop')
    assert.equal(s.players.length, 2)
    const me = s.players.find((p) => p.id === 'a')!
    assert.equal(me.holeCards?.length, 2)
    assert.equal(s.currentBet, 10)
  })

  it('awards pot on preflop fold', () => {
    const table = new HoldemTable({
      players: [
        { id: 'a', seat: 0, stack: 1000 },
        { id: 'b', seat: 1, stack: 1000 },
      ],
      smallBlind: 5,
      bigBlind: 10,
      buttonSeat: 0,
      shuffle: fixedShuffle,
    })
    table.startHand()
    const s0 = table.getState()
    const first = s0.players.find((p) => p.seat === s0.actionSeat)!
    const second = s0.players.find((p) => p.id !== first.id)!

    if (first.betThisRound < s0.currentBet) {
      act(table, first.id, { type: 'call' })
      act(table, second.id, { type: 'fold' })
    } else {
      act(table, first.id, { type: 'fold' })
    }

    const end = table.getState()
    assert.equal(end.handComplete, true)
    assert.equal(end.winners.length, 1)
    assert.equal(end.winners[0]!.handRank, undefined)
    const totalStacks = end.players.reduce((n, p) => n + p.stack, 0)
    assert.equal(totalStacks, 2000)
  })

  it('runs hand to showdown with checks', () => {
    const table = new HoldemTable({
      players: [
        { id: 'a', seat: 0, stack: 200 },
        { id: 'b', seat: 1, stack: 200 },
      ],
      smallBlind: 5,
      bigBlind: 10,
      buttonSeat: 0,
      shuffle: () => createDeck(),
    })
    table.startHand()

    for (let step = 0; step < 40; step++) {
      const s = table.getState()
      if (s.handComplete) break
      if (s.actionSeat === null) break
      const actor = s.players.find((p) => p.seat === s.actionSeat)!
      const toCall = s.currentBet - actor.betThisRound
      if (toCall > 0 && actor.stack >= toCall) {
        act(table, actor.id, { type: 'call' })
      } else if (toCall === 0) {
        act(table, actor.id, { type: 'check' })
      } else {
        act(table, actor.id, { type: 'all-in' })
      }
    }

    const end = table.getState()
    assert.equal(end.handComplete, true)
    assert.equal(end.board.length, 5)
    assert.ok(end.winners.length >= 1)
    for (const winner of end.winners) {
      assert.equal(typeof winner.handRank?.category, 'number')
      assert.equal(typeof winner.handRank?.name, 'string')
      assert.equal(winner.potIndex >= 0, true)
    }
    const total = end.players.reduce((n, p) => n + p.stack, 0)
    assert.equal(total, 400)
  })

  it('board-play split winners share the same handRank', () => {
    const table = new HoldemTable({
      players: [
        { id: 'a', seat: 0, stack: 200 },
        { id: 'b', seat: 1, stack: 200 },
      ],
      smallBlind: 5,
      bigBlind: 10,
      buttonSeat: 0,
      shuffle: riggedShuffle('2c 3d 4c 5d 6c Tc Jd Qh 7c Ks 8c As'),
    })
    table.startHand()
    driveCheckCallToCompletion(table)

    const end = table.getState()
    assert.equal(end.handComplete, true)
    assert.equal(end.winners.length, 2)
    assert.deepEqual(
      [...new Set(end.winners.map((w) => w.playerId))].sort(),
      ['a', 'b'],
    )
    assert.equal(end.winners[0]!.potIndex, 0)
    assert.equal(end.winners[1]!.potIndex, 0)
    assert.deepEqual(end.winners[0]!.handRank, end.winners[1]!.handRank)
    assert.equal(end.winners[0]!.handRank?.name, 'Straight')
  })

  it('rejects check when facing bet', () => {
    const table = new HoldemTable({
      players: [
        { id: 'a', seat: 0, stack: 500 },
        { id: 'b', seat: 1, stack: 500 },
      ],
      smallBlind: 5,
      bigBlind: 10,
      shuffle: fixedShuffle,
    })
    table.startHand()
    const s = table.getState()
    const actor = s.players.find((p) => p.seat === s.actionSeat)!
    if (actor.betThisRound < s.currentBet) {
      const r = table.applyAction(actor.id, { type: 'check' })
      assert.equal(r.ok, false)
    }
  })
})

describe('HoldemTable short-stack call', () => {
  it('treats heads-up preflop short-stack call as all-in', () => {
    const table = new HoldemTable({
      players: [
        { id: 'short', seat: 0, stack: 7 },
        { id: 'deep', seat: 1, stack: 500 },
      ],
      smallBlind: 5,
      bigBlind: 10,
      buttonSeat: 1,
      shuffle: () => createDeck(),
    })
    table.startHand()
    const startTotal = chipTotal(table)
    const pre = table.getState()
    const shortPre = pre.players.find((p) => p.id === 'short')!
    assert.equal(pre.actionSeat, shortPre.seat)
    assert.equal(pre.currentBet - shortPre.betThisRound, 5)
    assert.equal(shortPre.stack, 2)

    const r = table.applyAction('short', { type: 'call' })
    assert.equal(r.ok, true, r.error)

    const afterCall = table.getState()
    const short = afterCall.players.find((p) => p.id === 'short')!
    const deep = afterCall.players.find((p) => p.id === 'deep')!
    assert.equal(short.stack, 0)
    assert.equal(short.status, 'all-in')
    assert.equal(short.betThisRound, 7)
    assert.equal(short.betThisHand, 7)
    assert.equal(short.roundAction, 'Call all-in 2')
    assert.equal(afterCall.actionSeat, deep.seat)
    assert.equal(afterCall.currentBet - deep.betThisRound, 0)
    assert.equal(chipTotal(table), startTotal)

    act(table, 'deep', { type: 'check' })
    const flop = table.getState()
    assert.equal(flop.actionSeat, null)
    assert.equal(flop.board.length, 3)
    assert.equal(table.isRunoutPending(), true)
    assert.equal(chipTotal(table), startTotal)
  })

  it('treats 3-way postflop short-stack call as side-pot all-in', () => {
    const table = new HoldemTable({
      players: [
        { id: 'A', seat: 0, stack: 500 },
        { id: 'B', seat: 1, stack: 25 },
        { id: 'C', seat: 2, stack: 500 },
      ],
      smallBlind: 5,
      bigBlind: 10,
      buttonSeat: 2,
      shuffle: () => createDeck(),
    })
    table.startHand()
    const startStacks = 500 + 25 + 500

    act(table, 'A', { type: 'call' })
    act(table, 'B', { type: 'call' })
    act(table, 'C', { type: 'check' })

    const flopStart = table.getState()
    assert.equal(flopStart.bettingRound, 'flop')
    assert.equal(flopStart.actionSeat, 1)
    const shortBefore = flopStart.players.find((p) => p.id === 'B')!
    assert.equal(shortBefore.stack, 15)
    assert.equal(chipTotal(table), startStacks)

    act(table, 'B', { type: 'check' })
    act(table, 'C', { type: 'bet', total: 30 })
    act(table, 'A', { type: 'call' })
    const facingCall = table.getState()
    const shortFacing = facingCall.players.find((p) => p.id === 'B')!
    assert.equal(facingCall.actionSeat, shortFacing.seat)
    assert.equal(facingCall.currentBet - shortFacing.betThisRound, 30)
    assert.equal(shortFacing.stack, 15)

    const r = table.applyAction('B', { type: 'call' })
    assert.equal(r.ok, true, r.error)

    const turn = table.getState()
    const short = turn.players.find((p) => p.id === 'B')!
    const activeDeep = turn.players.filter(
      (p) => p.status === 'active' && p.stack > 0,
    )
    assert.equal(short.stack, 0)
    assert.equal(short.status, 'all-in')
    assert.equal(short.betThisHand, 25)
    assert.equal(activeDeep.length, 2)
    assert.equal(turn.bettingRound, 'turn')
    assert.notEqual(turn.actionSeat, short.seat)
    assert.equal(table.isRunoutPending(), false)
    assert.equal(chipTotal(table), startStacks)

    for (let i = 0; i < 20; i++) {
      const s = table.getState()
      if (s.handComplete) break
      if (s.actionSeat === null) break
      const actor = s.players.find((p) => p.seat === s.actionSeat)!
      const toCall = s.currentBet - actor.betThisRound
      if (toCall > 0) act(table, actor.id, { type: 'call' })
      else act(table, actor.id, { type: 'check' })
    }

    const end = table.getState()
    assert.equal(end.handComplete, true)
    assert.equal(end.bettingRound, 'showdown')
    assert.equal(end.board.length, 5)
    assert.deepEqual(
      end.pots.map((p) => p.amount),
      [75, 30],
    )
    assert.deepEqual(end.pots[0]!.eligible.sort(), ['A', 'B', 'C'])
    assert.deepEqual(end.pots[1]!.eligible.sort(), ['A', 'C'])
    const endStacks = end.players.reduce((n, p) => n + p.stack, 0)
    assert.equal(endStacks, startStacks)
    assert.ok(end.winners.every((w) => w.handRank))
  })

  it('side-pot winners carry handRank per pot with different winners', () => {
    const table = new HoldemTable({
      players: [
        { id: 'A', seat: 0, stack: 500 },
        { id: 'B', seat: 1, stack: 50 },
        { id: 'C', seat: 2, stack: 100 },
      ],
      smallBlind: 5,
      bigBlind: 10,
      buttonSeat: 2,
      shuffle: riggedShuffle('Qh Qd Kh Kd Jh Jd 2c 3c 4d 5h 6s'),
    })
    driveThreeWaySidePotAllIn(table)

    const end = table.getState()
    assert.equal(end.handComplete, true)
    assert.deepEqual(
      end.pots.map((p) => p.amount),
      [150, 100],
    )
    assert.deepEqual(
      end.winners.map((w) => ({
        playerId: w.playerId,
        potIndex: w.potIndex,
        rank: w.handRank?.name,
      })),
      [
        { playerId: 'B', potIndex: 0, rank: 'Two Pair' },
        { playerId: 'A', potIndex: 1, rank: 'Two Pair' },
      ],
    )
  })

  it('same player winning multiple pots keeps per-pot handRank details', () => {
    const table = new HoldemTable({
      players: [
        { id: 'A', seat: 0, stack: 500 },
        { id: 'B', seat: 1, stack: 50 },
        { id: 'C', seat: 2, stack: 100 },
      ],
      smallBlind: 5,
      bigBlind: 10,
      buttonSeat: 2,
      shuffle: riggedShuffle('Ah Ad Kh Kd Qh Qd 2c 3c 4d 5h 6s'),
    })
    driveThreeWaySidePotAllIn(table)

    const end = table.getState()
    const aWins = end.winners.filter((w) => w.playerId === 'A')
    assert.equal(end.handComplete, true)
    assert.deepEqual(
      aWins.map((w) => w.potIndex),
      [0, 1],
    )
    assert.ok(aWins.every((w) => w.handRank?.name === 'Two Pair'))
  })

  it('keeps a covered call as a normal call', () => {
    const table = new HoldemTable({
      players: [
        { id: 'caller', seat: 0, stack: 100 },
        { id: 'bb', seat: 1, stack: 100 },
      ],
      smallBlind: 5,
      bigBlind: 10,
      buttonSeat: 1,
      shuffle: () => createDeck(),
    })
    table.startHand()
    const startTotal = chipTotal(table)

    const r = table.applyAction('caller', { type: 'call' })
    assert.equal(r.ok, true, r.error)

    const s = table.getState()
    const caller = s.players.find((p) => p.id === 'caller')!
    assert.equal(caller.stack, 90)
    assert.equal(caller.status, 'active')
    assert.equal(caller.betThisRound, 10)
    assert.equal(caller.betThisHand, 10)
    assert.equal(caller.roundAction, 'Call 5')
    assert.equal(chipTotal(table), startTotal)
  })

  it('keeps explicit all-in action working', () => {
    const table = new HoldemTable({
      players: [
        { id: 'jammer', seat: 0, stack: 100 },
        { id: 'caller', seat: 1, stack: 200 },
      ],
      smallBlind: 5,
      bigBlind: 10,
      buttonSeat: 1,
      shuffle: () => createDeck(),
    })
    table.startHand()
    const startTotal = chipTotal(table)

    act(table, 'jammer', { type: 'all-in' })
    const jam = table.getState()
    const jammer = jam.players.find((p) => p.id === 'jammer')!
    assert.equal(jammer.stack, 0)
    assert.equal(jammer.status, 'all-in')
    assert.equal(jammer.betThisHand, 100)
    assert.equal(jammer.roundAction, 'All-in')

    act(table, 'caller', { type: 'call' })
    assert.equal(table.isRunoutPending(), true)
    assert.equal(chipTotal(table), startTotal)
  })

  it('does not lock runout after a partial call while two players can still act', () => {
    const table = new HoldemTable({
      players: [
        { id: 'A', seat: 0, stack: 500 },
        { id: 'B', seat: 1, stack: 25 },
        { id: 'C', seat: 2, stack: 500 },
        { id: 'D', seat: 3, stack: 500 },
      ],
      smallBlind: 5,
      bigBlind: 10,
      buttonSeat: 3,
      shuffle: () => createDeck(),
    })
    table.startHand()
    const startTotal = chipTotal(table)

    act(table, 'D', { type: 'call' })
    act(table, 'A', { type: 'call' })
    act(table, 'B', { type: 'call' })
    act(table, 'C', { type: 'check' })

    assert.equal(table.getState().bettingRound, 'flop')
    act(table, 'B', { type: 'check' })
    act(table, 'C', { type: 'bet', total: 30 })
    act(table, 'D', { type: 'call' })
    act(table, 'A', { type: 'call' })
    act(table, 'B', { type: 'call' })

    const turn = table.getState()
    const short = turn.players.find((p) => p.id === 'B')!
    assert.equal(short.status, 'all-in')
    assert.equal(short.stack, 0)
    assert.equal(
      turn.players.filter((p) => p.status === 'active' && p.stack > 0).length,
      3,
    )
    assert.equal(turn.bettingRound, 'turn')
    assert.notEqual(turn.actionSeat, null)
    assert.equal(table.isRunoutPending(), false)
    assert.equal(chipTotal(table), startTotal)
  })
})

describe('HoldemTable locked runout', () => {
  it('3-way locked runout: no action for lone active after short stack all-ins', () => {
    const table = threeWayLockedRunoutTable()
    driveThreeWayLockedRunout(table)

    const afterLock = table.getState()
    assert.equal(afterLock.actionSeat, null)
    assert.equal(afterLock.board.length, 3)
    assert.equal(afterLock.handComplete, false)
    assert.equal(afterLock.currentBet, 0)
    assert.equal(afterLock.minRaiseTo, 10)
    assert.equal(afterLock.lastAggressorSeat, null)
    assert.equal(table.isRunoutPending(), true)
    for (const p of afterLock.players.filter((x) => x.status !== 'folded')) {
      assert.equal(p.betThisRound, 0)
    }

    const a = afterLock.players.find((p) => p.id === 'a')!
    assert.equal(a.status, 'active')
    assert.ok(a.stack > 0)
    assert.equal(
      afterLock.players.filter((p) => p.status === 'all-in').length,
      2,
    )

    const turn = table.advanceRunout()
    assert.equal(turn.ok, true)
    assert.equal(turn.state!.board.length, 4)
    assert.equal(turn.state!.handComplete, false)

    const river = table.advanceRunout()
    assert.equal(river.ok, true)
    assert.equal(river.state!.board.length, 5)
    assert.equal(river.state!.handComplete, true)
  })

  it('4–6-way locked runout: lone active, rest all-in', () => {
    for (const n of [4, 5, 6]) {
      const table = nWayLockedRunoutTable(n)
      driveLockedRunout(table)

      const s = table.getState()
      assert.equal(s.actionSeat, null, `n=${n}`)
      assert.equal(s.board.length, 3, `n=${n}`)
      assert.equal(s.handComplete, false, `n=${n}`)
      assert.equal(
        s.players.filter((p) => p.status === 'active' && p.stack > 0).length,
        1,
        `n=${n}`,
      )
      assert.equal(
        s.players.filter((p) => p.status === 'all-in').length,
        n - 1,
        `n=${n}`,
      )
      assert.equal(table.isRunoutPending(), true, `n=${n}`)

      const turn = table.advanceRunout()
      assert.equal(turn.ok, true, `n=${n}`)
      assert.equal(turn.state!.board.length, 4, `n=${n}`)
      assert.equal(turn.state!.handComplete, false, `n=${n}`)

      const river = table.advanceRunout()
      assert.equal(river.ok, true, `n=${n}`)
      assert.equal(river.state!.board.length, 5, `n=${n}`)
      assert.equal(river.state!.handComplete, true, `n=${n}`)
      assert.ok(river.state!.winners.length >= 1, `n=${n}`)
      for (const winner of river.state!.winners) {
        assert.ok(winner.handRank, `n=${n}`)
        assert.equal(typeof winner.handRank!.category, 'number', `n=${n}`)
        assert.equal(typeof winner.handRank!.name, 'string', `n=${n}`)
      }
    }
  })

  it('heads-up one active + one all-in enters locked runout', () => {
    const table = new HoldemTable({
      players: [
        { id: 'deep', seat: 0, stack: 500 },
        { id: 'short', seat: 1, stack: 100 },
      ],
      smallBlind: 5,
      bigBlind: 10,
      buttonSeat: 0,
      shuffle: () => createDeck(),
    })
    table.startHand()
    const pre = table.getState()
    const deep = pre.players.find((p) => p.id === 'deep')!
    const short = pre.players.find((p) => p.id === 'short')!
    if (pre.actionSeat === deep.seat) {
      act(table, 'deep', { type: 'raise', total: 150 })
      act(table, 'short', { type: 'all-in' })
    } else {
      act(table, 'short', { type: 'all-in' })
      act(table, 'deep', { type: 'call' })
    }

    const s = table.getState()
    assert.equal(s.actionSeat, null)
    assert.equal(s.board.length, 3)
    assert.equal(s.handComplete, false)
    assert.equal(table.isRunoutPending(), true)

    table.advanceRunout()
    table.advanceRunout()
    assert.equal(table.getState().handComplete, true)
    assert.equal(table.getState().board.length, 5)
  })

  it('two active players still get flop action', () => {
    const table = new HoldemTable({
      players: [
        { id: 'a', seat: 0, stack: 500 },
        { id: 'b', seat: 1, stack: 500 },
      ],
      smallBlind: 5,
      bigBlind: 10,
      buttonSeat: 0,
      shuffle: () => createDeck(),
    })
    table.startHand()

    for (let i = 0; i < 20; i++) {
      const s = table.getState()
      if (s.bettingRound === 'flop') break
      if (s.handComplete || s.actionSeat === null) break
      const actor = s.players.find((p) => p.seat === s.actionSeat)!
      const toCall = s.currentBet - actor.betThisRound
      if (toCall > 0) {
        act(table, actor.id, { type: 'call' })
      } else {
        act(table, actor.id, { type: 'check' })
      }
    }

    const flop = table.getState()
    assert.equal(flop.bettingRound, 'flop')
    assert.equal(flop.board.length, 3)
    assert.notEqual(flop.actionSeat, null)
    assert.equal(table.isRunoutPending(), false)
  })

  it('3-way postflop skips all-in button when choosing action seat', () => {
    const table = new HoldemTable({
      players: [
        { id: 'A', seat: 0, stack: 500 },
        { id: 'B', seat: 1, stack: 20 },
        { id: 'C', seat: 2, stack: 500 },
      ],
      smallBlind: 5,
      bigBlind: 10,
      buttonSeat: 0,
      shuffle: () => createDeck(),
    })
    table.startHand()
    act(table, 'B', { type: 'all-in' })
    act(table, 'C', { type: 'call' })
    act(table, 'A', { type: 'call' })

    const flop = table.getState()
    assert.equal(flop.bettingRound, 'flop')
    assert.equal(flop.board.length, 3)
    assert.equal(flop.handComplete, false)
    assertValidCheckAction(table, 'B', 'flop')
  })

  it('4-6-way postflop skips all-in button with two active players', () => {
    for (const n of [4, 5, 6]) {
      const players = Array.from({ length: n }, (_, i) => ({
        id: String.fromCharCode(65 + i),
        seat: i,
        stack: i === 0 || i === 2 ? 500 : 20,
      }))
      const table = new HoldemTable({
        players,
        smallBlind: 5,
        bigBlind: 10,
        buttonSeat: 0,
        shuffle: () => createDeck(),
      })

      driveAllInButtonToFlop(table, new Set(['A', 'C']))

      const flop = table.getState()
      assert.equal(flop.bettingRound, 'flop', `n=${n}`)
      assert.equal(flop.board.length, 3, `n=${n}`)
      assert.equal(
        flop.players.filter((p) => p.status === 'active' && p.stack > 0).length,
        2,
        `n=${n}`,
      )
      assertValidCheckAction(table, 'B', 'flop')
    }
  })

  it('postflop wraps past non-seat-1 all-in button when choosing action seat', () => {
    const table = new HoldemTable({
      players: [
        { id: 'A', seat: 0, stack: 500 },
        { id: 'B', seat: 1, stack: 20 },
        { id: 'C', seat: 2, stack: 500 },
        { id: 'D', seat: 3, stack: 20 },
        { id: 'E', seat: 4, stack: 20 },
      ],
      smallBlind: 5,
      bigBlind: 10,
      buttonSeat: 3,
      shuffle: () => createDeck(),
    })

    driveAllInButtonToFlop(table, new Set(['A', 'C']))

    const flop = table.getState()
    const allInButton = flop.players.find((p) => p.id === 'E')!
    assert.equal(flop.buttonSeat, allInButton.seat)
    assert.equal(allInButton.seat, 4)
    assert.equal(flop.bettingRound, 'flop')
    assert.equal(flop.board.length, 3)
    assert.equal(
      flop.players.filter((p) => p.status === 'active' && p.stack > 0).length,
      2,
    )
    assertValidCheckAction(table, 'E', 'flop')
  })

  it('later postflop streets skip all-in button', () => {
    const table = new HoldemTable({
      players: [
        { id: 'A', seat: 0, stack: 500 },
        { id: 'B', seat: 1, stack: 50 },
        { id: 'C', seat: 2, stack: 500 },
      ],
      smallBlind: 5,
      bigBlind: 10,
      buttonSeat: 0,
      shuffle: () => createDeck(),
    })
    table.startHand()
    act(table, 'B', { type: 'call' })
    act(table, 'C', { type: 'call' })
    act(table, 'A', { type: 'check' })

    assert.equal(table.getState().bettingRound, 'flop')
    for (let i = 0; i < 20; i++) {
      const s = table.getState()
      if (s.bettingRound !== 'flop' || s.handComplete || s.actionSeat === null) break
      const actor = s.players.find((p) => p.seat === s.actionSeat)!
      const toCall = s.currentBet - actor.betThisRound
      if (actor.id === 'B') act(table, 'B', { type: 'all-in' })
      else if (toCall > 0) act(table, actor.id, { type: 'call' })
      else act(table, actor.id, { type: 'check' })
    }

    assertValidCheckAction(table, 'B', 'turn')
    for (let i = 0; i < 20; i++) {
      const s = table.getState()
      if (s.bettingRound !== 'turn' || s.handComplete || s.actionSeat === null) break
      const actor = s.players.find((p) => p.seat === s.actionSeat)!
      const toCall = s.currentBet - actor.betThisRound
      if (toCall > 0) act(table, actor.id, { type: 'call' })
      else act(table, actor.id, { type: 'check' })
    }

    const river = table.getState()
    assert.notEqual(river.bettingRound, 'turn')
    assert.notEqual(
      river.handComplete === false && river.actionSeat === null && !table.isRunoutPending(),
      true,
    )
  })

  it('conserves chips through locked runout and showdown', () => {
    const table = threeWayLockedRunoutTable()
    const startTotal = 200 + 50 + 50
    driveThreeWayLockedRunout(table)

    while (table.isRunoutPending()) {
      const r = table.advanceRunout()
      assert.equal(r.ok, true)
    }

    const end = table.getState()
    assert.equal(end.handComplete, true)
    const endTotal = end.players.reduce((n, p) => n + p.stack, 0)
    assert.equal(endTotal, startTotal)
  })

  it('turn-close locked runout deals river and completes showdown', () => {
    const table = new HoldemTable({
      players: [
        { id: 'A', seat: 0, stack: 500 },
        { id: 'B', seat: 1, stack: 200 },
        { id: 'C', seat: 2, stack: 200 },
        { id: 'D', seat: 3, stack: 200 },
      ],
      smallBlind: 5,
      bigBlind: 10,
      buttonSeat: 0,
      shuffle: () => createDeck(),
    })
    table.startHand()
    driveCheapPreflop(table)
    for (let i = 0; i < 60; i++) {
      const s = table.getState()
      if (s.bettingRound !== 'flop' || s.handComplete || s.actionSeat === null) break
      const actor = s.players.find((p) => p.seat === s.actionSeat)!
      const toCall = s.currentBet - actor.betThisRound
      if (toCall > 0) act(table, actor.id, { type: 'call' })
      else act(table, actor.id, { type: 'check' })
    }
    const turnStart = table.getState()
    assert.equal(turnStart.bettingRound, 'turn')
    assert.equal(turnStart.board.length, 4)
    for (let i = 0; i < 60; i++) {
      const s = table.getState()
      if (s.bettingRound !== 'turn' || s.handComplete || s.actionSeat === null) break
      const actor = s.players.find((p) => p.seat === s.actionSeat)!
      if (actor.id === 'B') act(table, 'B', { type: 'fold' })
      else if (actor.id === 'C' || actor.id === 'D') act(table, actor.id, { type: 'all-in' })
      else if (actor.id === 'A') {
        const toCall = s.currentBet - actor.betThisRound
        if (toCall > 0) act(table, 'A', { type: 'call' })
        else act(table, 'A', { type: 'check' })
      }
    }
    const end = table.getState()
    assert.equal(end.board.length, 5)
    assert.equal(end.handComplete, true)
    assert.equal(end.bettingRound, 'showdown')
    assert.ok(end.winners.length >= 1)
    assert.equal(table.isRunoutPending(), false)
  })

  it('advanceRunout fails when no runout pending', () => {
    const table = new HoldemTable({
      players: [
        { id: 'a', seat: 0, stack: 500 },
        { id: 'b', seat: 1, stack: 500 },
      ],
      smallBlind: 5,
      bigBlind: 10,
      shuffle: fixedShuffle,
    })
    table.startHand()
    const r = table.advanceRunout()
    assert.equal(r.ok, false)
    assert.equal(r.error, 'No runout pending')
  })
})

function chipTotal(table: HoldemTable): number {
  const s = table.getState()
  return s.players.reduce((n, p) => n + p.stack + p.betThisHand, 0)
}

function driveCheapPreflop(table: HoldemTable, target = 20) {
  for (let i = 0; i < 30; i++) {
    const s = table.getState()
    if (s.bettingRound !== 'preflop' || s.handComplete || s.actionSeat === null) {
      return
    }
    const actor = s.players.find((p) => p.seat === s.actionSeat)!
    const toCall = s.currentBet - actor.betThisRound
    if (toCall > 0) {
      act(table, actor.id, { type: 'call' })
    } else if (s.currentBet < target) {
      act(table, actor.id, { type: 'raise', total: target })
    } else {
      act(table, actor.id, { type: 'check' })
    }
  }
}

function driveFourWayFlopRefund(table: HoldemTable) {
  driveCheapPreflop(table)
  for (let i = 0; i < 60; i++) {
    const s = table.getState()
    if (s.bettingRound !== 'flop' || s.handComplete || s.actionSeat === null) {
      return
    }
    const actor = s.players.find((p) => p.seat === s.actionSeat)!
    const toCall = s.currentBet - actor.betThisRound
    if (actor.id === 'A') {
      if (toCall === 0 && s.currentBet < 200) {
        act(table, 'A', { type: 'bet', total: 200 })
      } else if (toCall > 0) {
        act(table, 'A', { type: 'raise', total: 200 })
      } else {
        act(table, 'A', { type: 'check' })
      }
    } else if (actor.id === 'B' || actor.id === 'D') {
      act(table, actor.id, { type: 'all-in' })
    } else if (actor.id === 'C' && s.currentBet > 0) {
      act(table, 'C', { type: 'fold' })
    } else if (toCall > 0) {
      act(table, actor.id, { type: 'call' })
    } else {
      act(table, actor.id, { type: 'check' })
    }
  }
}

describe('HoldemTable uncalled bet refund', () => {
  it('returns uncalled excess heads-up after short stack all-in', () => {
    const table = new HoldemTable({
      players: [
        { id: 'deep', seat: 0, stack: 500 },
        { id: 'short', seat: 1, stack: 100 },
      ],
      smallBlind: 5,
      bigBlind: 10,
      buttonSeat: 0,
      shuffle: () => createDeck(),
    })
    table.startHand()
    const startTotal = chipTotal(table)

    const pre = table.getState()
    const deep = pre.players.find((p) => p.id === 'deep')!
    const short = pre.players.find((p) => p.id === 'short')!
    if (pre.actionSeat === deep.seat) {
      act(table, 'deep', { type: 'raise', total: 200 })
      act(table, 'short', { type: 'all-in' })
    } else {
      act(table, 'short', { type: 'all-in' })
      act(table, 'deep', { type: 'call' })
    }

    const s = table.getState()
    const deepEnd = s.players.find((p) => p.id === 'deep')!
    const shortEnd = s.players.find((p) => p.id === 'short')!
    assert.equal(deepEnd.betThisHand, 100)
    assert.equal(shortEnd.betThisHand, 100)
    assert.equal(chipTotal(table), startTotal)
    assert.equal(table.isRunoutPending(), true)
  })

  it('4-way flop uncalled refund conserves chips through locked runout', () => {
    const startStacks = 500 + 70 + 500 + 70
    const table = new HoldemTable({
      players: [
        { id: 'A', seat: 0, stack: 500 },
        { id: 'B', seat: 1, stack: 70 },
        { id: 'C', seat: 2, stack: 500 },
        { id: 'D', seat: 3, stack: 70 },
      ],
      smallBlind: 5,
      bigBlind: 10,
      buttonSeat: 0,
      shuffle: () => createDeck(),
    })
    table.startHand()
    driveFourWayFlopRefund(table)

    const mid = table.getState()
    const a = mid.players.find((p) => p.id === 'A')!
    const b = mid.players.find((p) => p.id === 'B')!
    const c = mid.players.find((p) => p.id === 'C')!
    assert.equal(c.status, 'folded')
    assert.equal(a.betThisHand, b.betThisHand)
    assert.ok(a.betThisHand < 220, 'overbet excess should be refunded from betThisHand')
    assert.equal(table.isRunoutPending(), true)

    while (table.isRunoutPending()) {
      const r = table.advanceRunout()
      assert.equal(r.ok, true)
    }

    const end = table.getState()
    assert.equal(end.handComplete, true)
    const endStacks = end.players.reduce((n, p) => n + p.stack, 0)
    assert.equal(endStacks, startStacks)
  })

  it('3-way locked runout refunds uncalled before runout', () => {
    const startTotal = 500 + 50 + 50
    const table = new HoldemTable({
      players: [
        { id: 'a', seat: 0, stack: 500 },
        { id: 'b', seat: 1, stack: 50 },
        { id: 'c', seat: 2, stack: 50 },
      ],
      smallBlind: 5,
      bigBlind: 10,
      buttonSeat: 0,
      shuffle: () => createDeck(),
    })
    table.startHand()

    for (let i = 0; i < 20; i++) {
      const s = table.getState()
      if (s.board.length > 0 || s.handComplete) break
      if (s.actionSeat === null) break
      const actor = s.players.find((p) => p.seat === s.actionSeat)!
      if (actor.id === 'a') {
        if (s.currentBet < 200) {
          act(table, 'a', { type: 'raise', total: 200 })
        } else {
          act(table, 'a', { type: 'call' })
        }
      } else {
        act(table, actor.id, { type: 'all-in' })
      }
    }

    const mid = table.getState()
    const a = mid.players.find((p) => p.id === 'a')!
    const shortMatched = Math.min(
      mid.players.find((p) => p.id === 'b')!.betThisHand,
      mid.players.find((p) => p.id === 'c')!.betThisHand,
    )
    assert.equal(a.betThisHand, shortMatched)
    assert.equal(a.stack + a.betThisHand, 500)
    assert.equal(table.isRunoutPending(), true)

    while (table.isRunoutPending()) {
      const r = table.advanceRunout()
      assert.equal(r.ok, true)
    }

    const end = table.getState()
    assert.equal(end.handComplete, true)
    const endStacks = end.players.reduce((n, p) => n + p.stack, 0)
    assert.equal(endStacks, startTotal)
  })

  it('does not refund when all in-hand players matched the same amount', () => {
    const table = new HoldemTable({
      players: [
        { id: 'a', seat: 0, stack: 500 },
        { id: 'b', seat: 1, stack: 500 },
        { id: 'c', seat: 2, stack: 500 },
      ],
      smallBlind: 5,
      bigBlind: 10,
      buttonSeat: 0,
      shuffle: () => createDeck(),
    })
    table.startHand()
    const startTotal = chipTotal(table)

    for (let i = 0; i < 20; i++) {
      const s = table.getState()
      if (s.bettingRound !== 'preflop' || s.handComplete || s.actionSeat === null) {
        break
      }
      const actor = s.players.find((p) => p.seat === s.actionSeat)!
      const toCall = s.currentBet - actor.betThisRound
      if (toCall > 0) {
        act(table, actor.id, { type: 'call' })
      } else {
        act(table, actor.id, { type: 'check' })
      }
    }

    const s = table.getState()
    for (const p of s.players) {
      assert.equal(p.betThisHand, 10)
    }
    assert.equal(chipTotal(table), startTotal)
    assert.equal(s.bettingRound, 'flop')
  })

  it('does not refund when two players tie at the top bet', () => {
    const table = new HoldemTable({
      players: [
        { id: 'A', seat: 0, stack: 500 },
        { id: 'B', seat: 1, stack: 100 },
        { id: 'C', seat: 2, stack: 100 },
        { id: 'D', seat: 3, stack: 500 },
      ],
      smallBlind: 5,
      bigBlind: 10,
      buttonSeat: 0,
      shuffle: () => createDeck(),
    })
    table.startHand()
    const startTotal = chipTotal(table)

    for (let i = 0; i < 30; i++) {
      const s = table.getState()
      if (s.bettingRound !== 'preflop' || s.handComplete || s.actionSeat === null) {
        break
      }
      const actor = s.players.find((p) => p.seat === s.actionSeat)!
      const toCall = s.currentBet - actor.betThisRound
      if (actor.id === 'A' && s.currentBet < 200) {
        act(table, 'A', { type: 'raise', total: 200 })
      } else if (actor.id === 'B' || actor.id === 'C') {
        act(table, actor.id, { type: 'all-in' })
      } else if (toCall > 0) {
        act(table, actor.id, { type: 'call' })
      } else {
        act(table, actor.id, { type: 'check' })
      }
    }

    const s = table.getState()
    const a = s.players.find((p) => p.id === 'A')!
    const b = s.players.find((p) => p.id === 'B')!
    const c = s.players.find((p) => p.id === 'C')!
    const d = s.players.find((p) => p.id === 'D')!
    assert.equal(a.betThisHand, 200)
    assert.equal(d.betThisHand, 200)
    assert.equal(b.betThisHand, 100)
    assert.equal(c.betThisHand, 100)
    assert.equal(chipTotal(table), startTotal)
  })

  it('matched folded chips stay in pot at showdown', () => {
    const startTotal = 200 + 200 + 200
    const table = new HoldemTable({
      players: [
        { id: 'a', seat: 0, stack: 200 },
        { id: 'b', seat: 1, stack: 200 },
        { id: 'c', seat: 2, stack: 200 },
      ],
      smallBlind: 5,
      bigBlind: 10,
      buttonSeat: 0,
      shuffle: () => createDeck(),
    })
    table.startHand()

    for (let i = 0; i < 40; i++) {
      const s = table.getState()
      if (s.handComplete) break
      if (s.actionSeat === null) break
      const actor = s.players.find((p) => p.seat === s.actionSeat)!
      const toCall = s.currentBet - actor.betThisRound
      if (s.bettingRound === 'preflop') {
        if (toCall > 0) {
          act(table, actor.id, { type: 'call' })
        } else {
          act(table, actor.id, { type: 'check' })
        }
      } else if (s.bettingRound === 'flop' && actor.id === 'a') {
        act(table, 'a', { type: 'fold' })
      } else if (toCall > 0) {
        act(table, actor.id, { type: 'call' })
      } else {
        act(table, actor.id, { type: 'check' })
      }
    }

    const end = table.getState()
    assert.equal(end.handComplete, true)
    const potSum = end.pots.reduce((n, p) => n + p.amount, 0)
    assert.equal(potSum, 30)
    for (const pot of end.pots) {
      assert.equal(pot.eligible.includes('a'), false)
    }
    const endStacks = end.players.reduce((n, p) => n + p.stack, 0)
    assert.equal(endStacks, startTotal)
  })
})
