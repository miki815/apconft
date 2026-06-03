import { randomInt } from 'node:crypto'
import type { Card, Rank, Suit } from './types.js'

const SUITS: Suit[] = ['c', 'd', 'h', 's']
const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]

export function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit })
    }
  }
  return deck
}

/** Fisher–Yates shuffle (in-place copy). */
export function shuffleDeck(deck: Card[]): Card[] {
  const d = [...deck]
  for (let i = d.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[d[i], d[j]] = [d[j], d[i]]
  }
  return d
}

export function cardToString(c: Card): string {
  const r =
    c.rank === 14
      ? 'A'
      : c.rank === 13
        ? 'K'
        : c.rank === 12
          ? 'Q'
          : c.rank === 11
            ? 'J'
            : c.rank === 10
              ? 'T'
              : String(c.rank)
  return `${r}${c.suit}`
}

export function parseCard(s: string): Card {
  const t = s.trim().toLowerCase()
  if (t.length < 2) throw new Error(`Invalid card: ${s}`)
  const suit = t.slice(-1) as Suit
  if (!SUITS.includes(suit)) throw new Error(`Invalid suit: ${suit}`)
  const rankCh = t.slice(0, -1)
  let rank: Rank
  if (rankCh === 'a') rank = 14
  else if (rankCh === 'k') rank = 13
  else if (rankCh === 'q') rank = 12
  else if (rankCh === 'j') rank = 11
  else if (rankCh === 't' || rankCh === '10') rank = 10
  else {
    const n = parseInt(rankCh, 10)
    if (n < 2 || n > 9) throw new Error(`Invalid rank: ${rankCh}`)
    rank = n as Rank
  }
  return { rank, suit }
}

export function parseCards(s: string): Card[] {
  return s.split(/[\s,]+/).filter(Boolean).map(parseCard)
}
