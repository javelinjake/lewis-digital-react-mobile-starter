import { useEffect, useState } from 'react'
import { OutlineButton } from '@/components/ui'

function formatTimer(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function OptionalCountdown({ label, defaultSeconds = 30 }: { label: string, defaultSeconds?: number }) {
  const [open, setOpen] = useState(false)
  const [seconds, setSeconds] = useState(defaultSeconds)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!running)
      return
    const handle = window.setInterval(() => setSeconds(value => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(handle)
  }, [running])

  function hide() {
    setRunning(false)
    setOpen(false)
  }

  function adjust(delta: number) {
    setRunning(false)
    setSeconds(value => Math.max(0, value + delta))
  }

  if (!open) {
    return (
      <OutlineButton className="mb-4" onClick={() => setOpen(true)}>
        {label}
      </OutlineButton>
    )
  }

  return (
    <section className="mb-4 rounded-2xl border border-brand-line bg-brand-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-bold">Timer</span>
        <button type="button" className="text-sm font-bold text-brand-blue" onClick={hide}>
          Hide
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="size-9 rounded-full bg-brand-cream font-bold" onClick={() => adjust(-10)}>-10s</button>
        <span className="min-w-[4.5rem] text-center text-xl font-bold tabular-nums">{formatTimer(seconds)}</span>
        <button type="button" className="size-9 rounded-full bg-brand-cream font-bold" onClick={() => adjust(10)}>+10s</button>
        <button
          type="button"
          className="ml-auto rounded-full bg-brand-yellow px-4 py-2 text-sm font-bold text-brand-navy"
          onClick={() => setRunning(value => !value)}
        >
          {running ? 'Pause' : 'Start'}
        </button>
      </div>
    </section>
  )
}
