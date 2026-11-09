import type { CSSProperties } from 'react'
import type { FrameRect } from './atlas'
import { useEffect, useState } from 'react'

export interface SpriteProps {
  /** URL of the sheet image. */
  src: string
  /** Size of the whole sheet, in source pixels. */
  sheet: { width: number, height: number }
  frame: FrameRect
  /** Whole-number zoom. Fractions blur pixel art. */
  scale?: number
  className?: string
  style?: CSSProperties
  label?: string
}

/** One frame of a sprite sheet, scaled by a whole number with hard pixel edges. */
export function Sprite({ src, sheet, frame, scale = 3, className, style, label }: SpriteProps) {
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={className}
      style={{
        display: 'inline-block',
        width: frame.w * scale,
        height: frame.h * scale,
        backgroundImage: `url(${src})`,
        backgroundSize: `${sheet.width * scale}px ${sheet.height * scale}px`,
        backgroundPosition: `-${frame.x * scale}px -${frame.y * scale}px`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
        ...style,
      }}
    />
  )
}

/** Index that steps through `count` frames every `intervalMs`. Stays on frame 0 when not playing. */
export function useFrameIndex(count: number, intervalMs: number, playing = true) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!playing || count < 2) {
      setIndex(0)
      return
    }
    const timer = setInterval(() => setIndex(current => (current + 1) % count), intervalMs)
    return () => clearInterval(timer)
  }, [count, intervalMs, playing])

  return index
}

export interface AnimatedSpriteProps extends Omit<SpriteProps, 'frame'> {
  frames: readonly FrameRect[]
  intervalMs: number
  /** False shows the first frame only, for low-effects mode. */
  playing?: boolean
}

export function AnimatedSprite({ frames, intervalMs, playing = true, ...rest }: AnimatedSpriteProps) {
  const index = useFrameIndex(frames.length, intervalMs, playing)
  return <Sprite {...rest} frame={frames[index] ?? frames[0]} />
}
