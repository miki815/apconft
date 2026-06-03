import type { Card, Rank } from './types.js'

/** Higher category wins; tie-break via `kickers` left-to-right (higher first). */
export interface EvaluatedHand {
  category: HandCategory
  /** Descending strengths for comparison within category */
  kickers: number[]
}

export enum HandCategory {
  HighCard = 0,
  Pair = 1,
  TwoPair = 2,
  ThreeOfAKind = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  FourOfAKind = 7,
  StraightFlush = 8,
}

export function compareHands(a: EvaluatedHand, b: EvaluatedHand): number {
  if (a.category !== b.category) return a.category - b.category
  for (let i = 0; i < Math.max(a.kickers.length, b.kickers.length); i++) {
    const diff = (a.kickers[i] ?? 0) - (b.kickers[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/** Best 5-card hand from up to 7 cards. */
export function evaluateBest(cards: Card[]): EvaluatedHand {
  if (cards.length < 5) throw new Error('Need at least 5 cards')
  let best: EvaluatedHand | null = null
  const combo = cards.slice()
  const pick = (start: number, depth: number, buf: Card[]) => {
    if (depth === 5) {
      const ev = evaluateFive(buf)
      if (!best || compareHands(ev, best) > 0) best = ev
      return
    }
    for (let i = start; i <= cards.length - (5 - depth); i++) {
      buf.push(combo[i])
      pick(i + 1, depth + 1, buf)
      buf.pop()
    }
  }
  pick(0, 0, [])
  return best!
}

function evaluateFive(cards: Card[]): EvaluatedHand {
  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a)
  const suits = cards.map((c) => c.suit)
  const isFlush = suits.every((s) => s === suits[0])
  const straightHigh = straightHighCard(ranks)
  const rankCounts = countRanks(ranks)
  const counts = [...rankCounts.entries()].sort((a, b) =>
    b[1] !== a[1] ? b[1] - a[1] : b[0] - a[0],
  )

  if (isFlush && straightHigh !== null) {
    return { category: HandCategory.StraightFlush, kickers: [straightHigh] }
  }
  if (counts[0][1] === 4) {
    const quad = counts[0][0]
    const kicker = counts[1][0]
    return { category: HandCategory.FourOfAKind, kickers: [quad, kicker] }
  }
  if (counts[0][1] === 3 && counts[1][1] === 2) {
    return {
      category: HandCategory.FullHouse,
      kickers: [counts[0][0], counts[1][0]],
    }
  }
  if (isFlush) {
    return { category: HandCategory.Flush, kickers: ranks }
  }
  if (straightHigh !== null) {
    return { category: HandCategory.Straight, kickers: [straightHigh] }
  }
  if (counts[0][1] === 3) {
    const trips = counts[0][0]
    const kickers = counts.slice(1).map(([r]) => r)
    return { category: HandCategory.ThreeOfAKind, kickers: [trips, ...kickers] }
  }
  if (counts[0][1] === 2 && counts[1][1] === 2) {
    const high = Math.max(counts[0][0], counts[1][0])
    const low = Math.min(counts[0][0], counts[1][0])
    const kicker = counts[2][0]
    return { category: HandCategory.TwoPair, kickers: [high, low, kicker] }
  }
  if (counts[0][1] === 2) {
    const pair = counts[0][0]
    const kickers = counts.slice(1).map(([r]) => r)
    return { category: HandCategory.Pair, kickers: [pair, ...kickers] }
  }
  return { category: HandCategory.HighCard, kickers: ranks }
}

function countRanks(ranks: number[]): Map<number, number> {
  const m = new Map<number, number>()
  for (const r of ranks) m.set(r, (m.get(r) ?? 0) + 1)
  return m
}

/** Returns high card of straight, or 5 for wheel (A-2-3-4-5); null if no straight. */
function straightHighCard(sortedDesc: number[]): number | null {
  const unique = [...new Set(sortedDesc)].sort((a, b) => b - a)
  if (unique.includes(14)) unique.push(1)

  for (let i = 0; i <= unique.length - 5; i++) {
    let ok = true
    for (let j = 1; j < 5; j++) {
      if (unique[i + j] !== unique[i] - j) {
        ok = false
        break
      }
    }
    if (ok) return unique[i] === 1 ? 5 : unique[i]
  }
  return null
}

export function categoryName(cat: HandCategory): string {
  const names = [
    'High Card',
    'Pair',
    'Two Pair',
    'Three of a Kind',
    'Straight',
    'Flush',
    'Full House',
    'Four of a Kind',
    'Straight Flush',
  ]
  return names[cat] ?? 'Unknown'
}
