import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { HandCategory, compareHands, evaluateBest, parseCards } from './index.js'

describe('hand-eval', () => {
  it('ranks pair above high card', () => {
    const pair = evaluateBest(parseCards('Ah Ad 2c 3d 4h'))
    const high = evaluateBest(parseCards('Ah Kd Qc Jd 9h'))
    assert.ok(compareHands(pair, high) > 0)
    assert.equal(pair.category, HandCategory.Pair)
  })

  it('ranks flush above straight', () => {
    const flush = evaluateBest(parseCards('Ah Kh 9h 7h 2h Qc Jd'))
    const straight = evaluateBest(parseCards('9h 8d 7c 6s 5h Ah 2c'))
    assert.ok(compareHands(flush, straight) > 0)
  })

  it('detects wheel straight', () => {
    const wheel = evaluateBest(parseCards('Ah 2d 3c 4s 5h Kd Qc'))
    assert.equal(wheel.category, HandCategory.Straight)
    assert.deepEqual(wheel.kickers, [5])
  })

  it('detects straight flush', () => {
    const sf = evaluateBest(parseCards('9h 8h 7h 6h 5h 2c 3d'))
    assert.equal(sf.category, HandCategory.StraightFlush)
    assert.deepEqual(sf.kickers, [9])
  })

  it('splits tie on same full house', () => {
    const a = evaluateBest(parseCards('Ah Ad Ac Kd Kc 2s 3h'))
    const b = evaluateBest(parseCards('As Ah Ac Kh Ks 4d 5c'))
    assert.equal(compareHands(a, b), 0)
  })
})
