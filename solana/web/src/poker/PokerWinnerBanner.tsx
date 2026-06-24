import { potLabel } from './pots'
import type { WinnerGroup } from './types'
import type { PokerTableView } from './ws'
import { shortPk } from './ws'

interface PokerWinnerBannerProps {
  table: PokerTableView
  winnerGroups: WinnerGroup[]
  playerId: string | null
}

export function PokerWinnerBanner({
  table,
  winnerGroups,
  playerId,
}: PokerWinnerBannerProps) {
  return (
    <div className="winner-banner">
      <span className="winner-banner-title">
        {table.resultKind === 'showdown' ? 'Showdown rezultat' : 'Rezultat ruke'}
      </span>
      <div className="winner-banner-chips">
        {winnerGroups.map((group) => {
          const isYou = group.playerId === playerId
          return (
            <div
              key={group.playerId}
              className={['winner-chip', isYou ? 'winner-chip--you' : '']
                .filter(Boolean)
                .join(' ')}
            >
              <div className="winner-chip-head">
                <span className="winner-chip-name">
                  {isYou ? 'Ti' : shortPk(group.playerId)}
                </span>
                <strong className="winner-chip-total">+{group.total}</strong>
              </div>
              <div className="winner-chip-details">
                {group.wins.map((win) => (
                  <div
                    key={`${win.playerId}-${win.potIndex}`}
                    className={[
                      'winner-pot-row',
                      win.potIndex === 0 ? 'winner-pot-row--main' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <div className="winner-pot-head">
                      <span className="winner-pot-label">
                        {potLabel(win.potIndex)}
                      </span>
                      <span className="winner-pot-amount">+{win.amount}</span>
                    </div>
                    {win.handRank ? (
                      <span className="winner-pot-rank">{win.handRank.name}</span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
