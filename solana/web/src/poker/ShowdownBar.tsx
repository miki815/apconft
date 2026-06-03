import { SHOWDOWN_MS } from './showdown'

export function ShowdownBar({ durationMs = SHOWDOWN_MS }: { durationMs?: number }) {
  const sec = durationMs / 1000

  return (
    <div className="showdown-bar-wrap" role="timer" aria-label="Showdown">
      <div
        className="showdown-bar-fill"
        style={{ animationDuration: `${sec}s` }}
      />
    </div>
  )
}
