import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildPots, splitPot } from './pot.js'

describe('pot', () => {
  it('builds main and side pot', () => {
    const pots = buildPots(
      [
        { playerId: 'a', amount: 100 },
        { playerId: 'b', amount: 100 },
        { playerId: 'c', amount: 50 },
      ],
      new Set(),
    )
    assert.equal(pots.length, 2)
    assert.equal(pots[0].amount, 150)
    assert.deepEqual(pots[0].eligible.sort(), ['a', 'b', 'c'])
    assert.equal(pots[1].amount, 100)
    assert.deepEqual(pots[1].eligible.sort(), ['a', 'b'])
  })

  it('excludes folded from eligibility', () => {
    const pots = buildPots(
      [
        { playerId: 'a', amount: 50 },
        { playerId: 'b', amount: 50 },
      ],
      new Set(['b']),
    )
    assert.equal(pots[0].eligible.join(), 'a')
  })

  it('splits remainder chip', () => {
    const s = splitPot(10, ['a', 'b', 'c'])
    const total = s.reduce((n, x) => n + x.amount, 0)
    assert.equal(total, 10)
    assert.equal(s[0].amount, 4)
  })
})
