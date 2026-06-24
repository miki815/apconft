import { CardRow } from './PlayingCard'
import { PokerSeat } from './PokerSeat'
import { PotBreakdown } from './PotBreakdown'
import type { Card, PokerTableView } from './ws'
import type { DisplayPot } from './pots'

const SEAT_POS: readonly [number, number][] = [
  [50, 6],
  [86, 24],
  [86, 76],
  [50, 94],
  [14, 76],
  [14, 24],
]

interface PokerTableVisualProps {
  table: PokerTableView | null
  mySeat: number | null | undefined
  pickSeat: number
  showdownPhase: boolean
  resultPhase: boolean
  winnerIds: Set<string>
  potDisplay: {
    total: number
    showBreakdown: boolean
    pots: DisplayPot[]
  }
  showBoard: boolean
  board: Card[]
  onPickSeat: (seat: number) => void
}

export function PokerTableVisual({
  table,
  mySeat,
  pickSeat,
  showdownPhase,
  resultPhase,
  winnerIds,
  potDisplay,
  showBoard,
  board,
  onPickSeat,
}: PokerTableVisualProps) {
  return (
    <div
      className={`poker-table-wrap${potDisplay.showBreakdown ? ' poker-table-wrap--pot-breakdown' : ''}`}
    >
      <div
        className={`table-visual table-visual--poker ${resultPhase ? 'table-visual--showdown' : ''}`}
      >
        <div className="table-rail" />

        <div className="table-center">
          {showBoard ? (
            <div className="board-zone">
              <CardRow cards={board} size="md" slots={5} />
            </div>
          ) : null}

          <div className="pot-label pot-label--poker">
            <span className="pot-icon" aria-hidden="true">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 2.75c-4.97 0-9 1.9-9 4.25S7.03 11.25 12 11.25s9-1.9 9-4.25-4.03-4.25-9-4.25Z"
                  fill="currentColor"
                  opacity="0.95"
                />
                <path
                  d="M3 7v3.25C3 12.6 7.03 14.5 12 14.5s9-1.9 9-4.25V7c0 2.35-4.03 4.25-9 4.25S3 9.35 3 7Z"
                  fill="currentColor"
                  opacity="0.75"
                />
                <path
                  d="M3 10.25V13.5c0 2.35 4.03 4.25 9 4.25s9-1.9 9-4.25v-3.25c0 2.35-4.03 4.25-9 4.25s-9-1.9-9-4.25Z"
                  fill="currentColor"
                  opacity="0.55"
                />
                <path
                  d="M3 13.5v3.5c0 2.35 4.03 4.25 9 4.25s9-1.9 9-4.25v-3.5c0 2.35-4.03 4.25-9 4.25s-9-1.9-9-4.25Z"
                  fill="currentColor"
                  opacity="0.4"
                />
              </svg>
            </span>
            <span className="pot-amount">{potDisplay.total}</span>
          </div>
        </div>

        {SEAT_POS.map(([left, top], seat) => (
          <PokerSeat
            key={seat}
            seat={seat}
            left={left}
            top={top}
            table={table}
            mySeat={mySeat}
            pickSeat={pickSeat}
            showdownPhase={showdownPhase}
            resultPhase={resultPhase}
            winnerIds={winnerIds}
            onPickSeat={onPickSeat}
          />
        ))}

        {resultPhase ? (
          <div className="showdown-overlay" aria-live="polite">
            <span className="showdown-overlay-title">
              {showdownPhase ? 'Showdown' : 'Rezultat ruke'}
            </span>
          </div>
        ) : null}
      </div>
      {potDisplay.showBreakdown ? (
        <PotBreakdown pots={potDisplay.pots} />
      ) : null}
    </div>
  )
}
