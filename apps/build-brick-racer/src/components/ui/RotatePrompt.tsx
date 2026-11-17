import { Icon } from '@/components/ui/Icon'

/** Shown by CSS only in portrait on phones. The game is landscape. */
export function RotatePrompt() {
  return (
    <div className="br-rotate" role="alert">
      <Icon name="rotate" size={64} />
      <p className="br-display text-2xl">Turn your device sideways</p>
      <p className="max-w-xs opacity-80">Build Brick Racer plays in landscape so you can see your car and the track.</p>
    </div>
  )
}
