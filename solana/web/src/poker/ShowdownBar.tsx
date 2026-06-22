import { useEffect, useMemo, useState } from 'react'

interface ShowdownBarProps {
  endsAt: number
  durationMs: number
}

function isValidCountdownInput(endsAt: number, durationMs: number): boolean {
  return Number.isFinite(endsAt) && Number.isFinite(durationMs) && durationMs > 0
}

export function ShowdownBar({ endsAt, durationMs }: ShowdownBarProps) {
  const [now, setNow] = useState(() => Date.now())
  const valid = isValidCountdownInput(endsAt, durationMs)

  useEffect(() => {
    if (!valid) return

    let rafId = 0
    let cancelled = false

    const tick = () => {
      if (cancelled) return

      const currentNow = Date.now()
      const remainingMs = Math.max(0, endsAt - currentNow)
      setNow(currentNow)

      if (remainingMs > 0) {
        rafId = requestAnimationFrame(tick)
      }
    }

    tick()

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
    }
  }, [endsAt, durationMs, valid])

  const remainingMs = valid ? Math.max(0, endsAt - now) : 0
  const progress = useMemo(() => {
    if (!valid) return 0
    return Math.max(0, Math.min(1, remainingMs / durationMs))
  }, [valid, durationMs, remainingMs])
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
