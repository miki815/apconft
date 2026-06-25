import type { Card, PokerTableView } from './wsTypes'

export function cardLabel(c: Card): string {
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
  const s =
    c.suit === 'h'
      ? '♥'
      : c.suit === 'd'
        ? '♦'
        : c.suit === 'c'
          ? '♣'
          : '♠'
  return `${r}${s}`
}

export function shortPk(pk: string): string {
  return `${pk.slice(0, 4)}…${pk.slice(-4)}`
}

export function preflightSitMessage(
  table: PokerTableView | null,
  pickSeat: number,
  buyIn: number,
): string | null {
  if (!table) return 'Nema podataka o stolu — sačekaj konekciju'
  if (table.you.seat !== null) return 'Već si za stolom'
  if (table.seats[pickSeat]) return `Mesto ${pickSeat + 1} je zauzeto`
  if (!Number.isInteger(buyIn) || buyIn <= 0) return 'Unesi ispravan buy-in'
  return null
}
