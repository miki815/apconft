import { useEffect, useMemo, useState } from 'react'
import type { ServerClockAnchor } from './ws'

interface ShowdownBarProps {
  endsAt: number
  durationMs: number
  clockAnchor: ServerClockAnchor
}

export function ShowdownBar({
  endsAt,
  durationMs,
  clockAnchor,
}: ShowdownBarProps) {
  const [tickPerf, setTickPerf] = useState(() => performance.now())

  useEffect(() => {
    let rafId = 0
    let cancelled = false

    const tick = () => {
      if (cancelled) return
      const nowPerf = performance.now()
      setTickPerf(nowPerf)

      const effective =
        clockAnchor.serverNow +
        (nowPerf - clockAnchor.receivedAtPerformanceNow)
      const remaining = Math.max(0, endsAt - effective)

      if (remaining > 0) {
        rafId = requestAnimationFrame(tick)
      }
    }

    tick()

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
    }
  }, [
    endsAt,
    durationMs,
    clockAnchor.serverNow,
    clockAnchor.receivedAtPerformanceNow,
  ])

  const elapsedPerf = Math.max(
    0,
    tickPerf - clockAnchor.receivedAtPerformanceNow,
  )
  const effectiveServerNow = clockAnchor.serverNow + elapsedPerf
  const remainingMs = Math.max(0, endsAt - effectiveServerNow)
  const progress = useMemo(
    () => Math.max(0, Math.min(1, remainingMs / durationMs)),
    [durationMs, remainingMs],
  )
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
