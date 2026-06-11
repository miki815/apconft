import { useEffect, useState } from 'react'

export function RebuyGraceBar({ deadlineAt }: { deadlineAt: number }) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000)),
  )

  useEffect(() => {
    const tick = () => {
      setSecondsLeft(Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000)))
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [deadlineAt])

  return (
    <div className="rebuy-grace panel" role="timer" aria-label="Rebuy grace">
      <p className="stats">
        Nemaš čipova — dopuni za <strong>{secondsLeft}s</strong> ili napuštaš
        sto.
      </p>
    </div>
  )
}
