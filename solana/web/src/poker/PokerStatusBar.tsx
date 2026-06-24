import { shortPk } from './ws'

interface PokerStatusBarProps {
  connected: boolean
  playerId: string | null
  handInProgress?: boolean
  smallBlind?: number
  bigBlind?: number
}

export function PokerStatusBar({
  connected,
  playerId,
  handInProgress,
  smallBlind,
  bigBlind,
}: PokerStatusBarProps) {
  return (
    <div className="poker-status-bar">
      <span
        className={`status-pill ${connected ? 'status-pill--on' : 'status-pill--off'}`}
      >
        {connected ? 'Live' : 'Offline'}
      </span>
      {playerId ? (
        <span className="poker-player-id">{shortPk(playerId)}</span>
      ) : (
        <span className="poker-player-id muted">Poveži novčanik</span>
      )}
      {handInProgress ? (
        <span className="poker-meta">
          Blinds {smallBlind}/{bigBlind}
        </span>
      ) : null}
    </div>
  )
}
