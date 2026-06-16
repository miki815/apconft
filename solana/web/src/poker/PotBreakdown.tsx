import type { DisplayPot } from './pots'

interface PotBreakdownProps {
  pots: DisplayPot[]
}

export function PotBreakdown({ pots }: PotBreakdownProps) {
  if (pots.length < 2) return null

  return (
    <div className="pot-breakdown" aria-label="Side pot breakdown">
      {pots.map((pot) => (
        <div
          key={pot.key}
          className={[
            'pot-breakdown-row',
            pot.isEligibleForMe ? 'pot-breakdown-row--mine' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div className="pot-breakdown-head">
            <span className="pot-breakdown-label">{pot.label}</span>
            <span className="pot-breakdown-amount">{pot.amount}</span>
          </div>
          {pot.seatLabels.length > 0 ? (
            <span className="pot-breakdown-eligible">
              {pot.seatLabels.join(' · ')}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  )
}
