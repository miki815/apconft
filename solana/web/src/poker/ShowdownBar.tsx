import { useEffect, useMemo, useState } from 'react'

interface ShowdownBarProps {
  endsAt: number
  durationMs: number
}

export function ShowdownBar({ endsAt, durationMs }: ShowdownBarProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(timer)
  }, [endsAt, durationMs])

  const remainingMs = Math.max(0, endsAt - now)
  const progress = useMemo(() => {
    if (durationMs <= 0) return 0
    return Math.max(0, Math.min(1, remainingMs / durationMs))
  }, [durationMs, remainingMs])
  const seconds = Math.ceil(remainingMs / 1000)

  return (
    <div
      className="showdown-bar-wrap"
      role="timer"
      aria-label={`Sledeća ruka za ${seconds} sekundi`}
    >
      <div className="showdown-bar-track">
        <div
          className="showdown-bar-fill"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
      <span className="showdown-bar-text">Sledeća ruka za {seconds}s</span>
    </div>
  )
}
