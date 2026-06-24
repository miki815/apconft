import { PlayingCard } from './PlayingCard'
import type { Card, PlayerAction, PokerTableView } from './ws'
import { cardLabel } from './ws'

export interface RaiseBounds {
  min: number
  max: number
  step: number
  isBet: boolean
}

interface PokerHeroBarProps {
  holeCards: Card[]
  table: PokerTableView | null
  myStack: number
  isShortStackCall: boolean
  canRaise: boolean
  raiseBounds: RaiseBounds | null
  raiseTotal: number
  onRaiseTotalChange: (value: number) => void
  onAct: (action: PlayerAction) => void
}

export function PokerHeroBar({
  holeCards,
  table,
  myStack,
  isShortStackCall,
  canRaise,
  raiseBounds,
  raiseTotal,
  onRaiseTotalChange,
  onAct,
}: PokerHeroBarProps) {
  return (
    <div className="hero-bar">
      <div className="hero-hand">
        <p className="hero-hand-label">Tvoje karte</p>
        {holeCards.length === 2 ? (
          <div className="hero-hand-cards">
            {holeCards.map((c, i) => (
              <PlayingCard
                key={`${cardLabel(c)}-${i}`}
                card={c}
                size="lg"
              />
            ))}
          </div>
        ) : (
          <div className="hero-hand-cards hero-hand-cards--idle">
            <PlayingCard size="lg" faceDown />
            <PlayingCard size="lg" faceDown />
          </div>
        )}
      </div>

      {table?.you.canAct ? (
        <div className="hero-actions">
          {table.you.toCall > 0 ? (
            <span className="hero-actions-hint">
              {isShortStackCall ? (
                <>
                  Call all-in <strong>{myStack}</strong>
                </>
              ) : (
                <>
                  Call <strong>{table.you.toCall}</strong>
                </>
              )}
            </span>
          ) : null}
          {canRaise && raiseBounds ? (
            <div className="hero-raise">
              <div className="hero-raise-head">
                <span className="hero-raise-label">
                  {raiseBounds.isBet ? 'Bet' : 'Raise'}
                </span>
                <span className="hero-raise-value">{raiseTotal}</span>
              </div>
              <input
                type="range"
                className="hero-raise-slider"
                min={raiseBounds.min}
                max={raiseBounds.max}
                step={raiseBounds.step}
                value={raiseTotal}
                onChange={(e) =>
                  onRaiseTotalChange(parseInt(e.target.value, 10))
                }
              />
              <div className="hero-raise-range">
                <span>{raiseBounds.min}</span>
                <span>{raiseBounds.max}</span>
              </div>
            </div>
          ) : null}
          <div className="hero-actions-btns">
            <button
              type="button"
              className="btn-fold"
              onClick={() => onAct({ type: 'fold' })}
            >
              Fold
            </button>
            {table.you.toCall === 0 ? (
              <button
                type="button"
                className="secondary"
                onClick={() => onAct({ type: 'check' })}
              >
                Check
              </button>
            ) : (
              <button
                type="button"
                className="primary"
                onClick={() => onAct({ type: 'call' })}
              >
                {isShortStackCall ? `Call all-in ${myStack}` : 'Call'}
              </button>
            )}
            {canRaise && raiseBounds ? (
              <button
                type="button"
                className="primary"
                onClick={() =>
                  onAct(
                    raiseBounds.isBet
                      ? { type: 'bet', total: raiseTotal }
                      : { type: 'raise', total: raiseTotal },
                  )
                }
              >
                {raiseBounds.isBet ? 'Bet' : 'Raise'} {raiseTotal}
              </button>
            ) : null}
            <button
              type="button"
              className="btn-allin"
              onClick={() => onAct({ type: 'all-in' })}
            >
              All-in
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
