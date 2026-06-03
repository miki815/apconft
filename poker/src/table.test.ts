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
