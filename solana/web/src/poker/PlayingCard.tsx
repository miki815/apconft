import type { Card } from './ws'
import { cardLabel } from './ws'

const SUIT_SYM: Record<string, string> = {
  h: '♥',
  d: '♦',
  c: '♣',
  s: '♠',
}

function isRed(suit: string) {
  return suit === 'h' || suit === 'd'
}

function rankDisplay(rank: number): string {
  if (rank === 14) return 'A'
  if (rank === 13) return 'K'
  if (rank === 12) return 'Q'
  if (rank === 11) return 'J'
  if (rank === 10) return '10'
  return String(rank)
}

export function PlayingCard({
  card,
  size = 'md',
  faceDown = false,
}: {
  card?: Card
  size?: 'sm' | 'md' | 'lg'
  faceDown?: boolean
}) {
  if (faceDown || !card) {
    return (
      <div className={`playing-card playing-card--${size} playing-card--back`}>
        <span className="card-back-pattern" />
      </div>
    )
  }

  const red = isRed(card.suit)
  const rank = rankDisplay(card.rank)
  const suit = SUIT_SYM[card.suit] ?? card.suit

  return (
    <div
      className={`playing-card playing-card--${size} ${red ? 'playing-card--red' : 'playing-card--black'}`}
      title={cardLabel(card)}
      aria-label={cardLabel(card)}
    >
      <span className="card-corner card-corner--tl">
        <span className="card-rank">{rank}</span>
        <span className="card-suit">{suit}</span>
      </span>
      <span className="card-pip">{suit}</span>
      <span className="card-corner card-corner--br">
        <span className="card-rank">{rank}</span>
        <span className="card-suit">{suit}</span>
      </span>
    </div>
  )
}

export function CardRow({
  cards,
  size = 'md',
  slots = 0,
}: {
  cards: Card[]
  size?: 'sm' | 'md' | 'lg'
  slots?: number
}) {
  const count = slots > 0 ? slots : cards.length
  if (count === 0) return null

  return (
    <div className={`card-row card-row--${size}`}>
      {Array.from({ length: count }, (_, i) => (
        <PlayingCard key={i} card={cards[i]} size={size} faceDown={!cards[i]} />
      ))}
    </div>
  )
}
