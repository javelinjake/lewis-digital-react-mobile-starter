import type { WarmupZone } from '@ld/pixel-pitch-core'
import { markerAt, warmupBar } from '@ld/pixel-pitch-core'
import { useMemo, useRef, useState } from 'react'
import { useGameConfig } from '../queries/use-game'
import { TimingBar } from './TimingBar'

const MIN_TAP_MS = 150

/** The warm-up kick: one tap on a timing bar. Gold is +10% attack in the next match, green +5%, a miss +2%. */
export function WarmupGame({ seed, onFinish }: { seed: string, onFinish: (tapMs: number) => void }) {
  const config = useGameConfig()
  const bar = useMemo(() => warmupBar(seed, config), [seed, config])
  const { goldWidth, greenWidth } = config.minigames.warmup
  const startedAt = useRef(performance.now())
  const [zone, setZone] = useState<WarmupZone | null>(null)

  const kick = () => {
    if (zone)
      return
    const ms = Math.round(performance.now() - startedAt.current)
    if (ms < MIN_TAP_MS)
      return
    const distance = Math.abs(markerAt(bar, ms) - bar.centre)
    setZone(distance <= goldWidth / 2 ? 'gold' : distance <= greenWidth / 2 ? 'green' : 'miss')
    setTimeout(() => onFinish(ms), 900)
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <TimingBar
        bar={bar}
        running={zone === null}
        startedAt={startedAt}
        zones={[
          { halfWidth: greenWidth / 2, colour: '#3fa34d', label: 'green' },
          { halfWidth: goldWidth / 2, colour: '#ffd23f', label: 'gold' },
        ]}
      />
      <div className="h-8 font-display text-sm text-primary" aria-live="polite">{zone === 'gold' ? 'Perfect!' : zone === 'green' ? 'Good' : zone === 'miss' ? 'Missed' : ''}</div>
      <button type="button" className="btn btn-primary h-20 w-full font-display text-lg" onPointerDown={kick} disabled={zone !== null}>KICK!</button>
    </div>
  )
}
