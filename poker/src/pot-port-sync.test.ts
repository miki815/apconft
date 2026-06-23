import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildPots as backendBuildPots } from './pot.js'
import { buildPots as frontendBuildPots } from '../../solana/web/src/poker/pots.ts'

type PotLike = { amount: number; eligible: string[] }

function normalizePots(pots: PotLike[]): PotLike[] {
  return pots.map((p) => ({
    amount: p.amount,
    eligible: [...p.eligible].sort(),
  }))
}

function assertBuildPotsMatch(
  contributions: { playerId: string; amount: number }[],
  folded: Set<string>,
): void {
  const backend = normalizePots(backendBuildPots(contributions, folded))
  const frontend = normalizePots(frontendBuildPots(contributions, folded))
  assert.deepEqual(frontend, backend)
}

describe('buildPots backend/frontend sync', () => {
  it('main + side pot matches frontend port', () => {
    const contributions = [
      { playerId: 'a', amount: 100 },
      { playerId: 'b', amount: 100 },
      { playerId: 'c', amount: 50 },
    ]
    assertBuildPotsMatch(contributions, new Set())

    const pots = backendBuildPots(contributions, new Set())
    assert.equal(pots.length, 2)
    assert.equal(pots[0].amount, 150)
    assert.deepEqual(pots[0].eligible.sort(), ['a', 'b', 'c'])
    assert.equal(pots[1].amount, 100)
    assert.deepEqual(pots[1].eligible.sort(), ['a', 'b'])
  })

  it('folded eligibility matches frontend port', () => {
    const contributions = [
      { playerId: 'a', amount: 50 },
      { playerId: 'b', amount: 50 },
    ]
    const folded = new Set(['b'])
    assertBuildPotsMatch(contributions, folded)

    const pots = backendBuildPots(contributions, folded)
    assert.equal(pots[0].amount, 100)
    assert.equal(pots[0].eligible.join(), 'a')
  })

  it('multi-level side pots match frontend port', () => {
    assertBuildPotsMatch(
      [
        { playerId: 'a', amount: 200 },
        { playerId: 'b', amount: 100 },
        { playerId: 'c', amount: 50 },
      ],
      new Set(),
    )
  })
})
