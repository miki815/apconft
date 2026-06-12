import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createDeck, HoldemTable } from './index.js'
import type { Card } from './types.js'

function fixedShuffle(cards: Card[]): Card[] {
  return cards
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
    const total = end.players.reduce((n, p) => n + p.stack, 0)
    assert.equal(total, 400)
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
