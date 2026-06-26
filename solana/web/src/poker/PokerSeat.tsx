// Prikaz jednog mesta: igrač, stack, karte i izbor slobodnog mesta pre buy-in-a.
import { PlayingCard } from './PlayingCard'
import type { Card, PokerTableView } from './ws'
import { cardLabel, shortPk } from './ws'

interface PokerSeatProps {
  seat: number
  left: number
  top: number
  table: PokerTableView | null
  mySeat: number | null | undefined
  pickSeat: number
  showdownPhase: boolean
  resultPhase: boolean
  winnerIds: Set<string>
  onPickSeat: (seat: number) => void
}

export function PokerSeat({
  seat,
  left,
  top,
  table,
  mySeat,
  pickSeat,
  showdownPhase,
  resultPhase,
  winnerIds,
  onPickSeat,
}: PokerSeatProps) {
  const info = table?.seats[seat]
  const inHand = table?.state.players.find((p) => p.seat === seat)
  const isMe = mySeat === seat
  const isAction = table?.state.actionSeat === seat
  const folded = inHand?.status === 'folded'
  const isWinner = !!info && resultPhase && winnerIds.has(info.playerId)
  const displayStack =
    inHand !== undefined ? inHand.stack : (info?.stack ?? 0)
  const revealCards =
    showdownPhase &&
    !isMe &&
    inHand?.holeCards &&
    inHand.holeCards.length === 2 &&
    inHand.status !== 'folded'

  return (
    <div
      className="seat-wrap"
      style={{ left: `${left}%`, top: `${top}%` }}
    >
      {revealCards ? (
        <div className="seat-reveal-cards">
          {inHand!.holeCards!.map((c: Card, i: number) => (
            <PlayingCard
              key={`${cardLabel(c)}-${i}`}
              card={c}
              size="sm"
            />
          ))}
        </div>
      ) : null}
      <button
        type="button"
        className={[
          'seat',
          'seat--poker',
          pickSeat === seat ? 'selected' : '',
          isMe ? 'you' : '',
          isAction ? 'action' : '',
          isWinner ? 'winner' : '',
          folded ? 'folded' : '',
          info ? 'occupied' : 'empty',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => onPickSeat(seat)}
      >
        <span className="seat-num">{seat + 1}</span>
        {info ? (
          <>
            <span className="seat-name">
              {isMe ? 'Ti' : shortPk(info.playerId)}
            </span>
            <span className="seat-stack">{displayStack}</span>
            {inHand?.roundAction &&
            table?.handInProgress &&
            !showdownPhase ? (
              <span className="seat-action">{inHand.roundAction}</span>
            ) : null}
          </>
        ) : (
          <span className="seat-empty-label">Slobodno</span>
        )}
      </button>
    </div>
  )
}
