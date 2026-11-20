import { useEffect, useState } from 'react'

function format(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, '0')}m` : `${minutes}:${String(seconds).padStart(2, '0')}`
}

/**
 * Counts down to a server time. `offset` is server minus device time, so a phone with a wrong clock still counts
 * right. Calls `onDone` once when it reaches zero (the hub syncs then, to play the match).
 */
export function Countdown({ to, offset, onDone }: { to: number, offset: number, onDone?: () => void }) {
  const [now, setNow] = useState(() => Date.now() + offset)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() + offset), 1000)
    return () => clearInterval(timer)
  }, [offset])

  const done = now >= to
  useEffect(() => {
    if (done)
      onDone?.()
  }, [done, onDone])

  return <span className="tabular-nums">{done ? 'Now' : format(to - now)}</span>
}
