import type { WelcomeBackEvent } from '@ld/pixel-pitch-core'
import { art } from '../lib/art'
import { leagueName } from '../lib/club'
import { Icon } from './sprites'

/** What happened while the player was away. Shown once per sync that had news. */
export function WelcomeBack({ events, onClose }: { events: WelcomeBackEvent[], onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6" role="dialog" aria-modal="true" aria-label="Welcome back">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 border-2 border-primary bg-base-100 p-5">
        <img src={art('text/banner_welcome_back.png')} alt="Welcome back" className="pixel h-auto w-48" />
        <ul className="flex w-full flex-col gap-2 text-lg">
          {events.map((event) => {
            if (event.type === 'matches') {
              return (
                <li key={event.type} className="flex flex-col gap-1">
                  <span>
                    <Icon path="icons/ui_whistle.png" />
                    {' '}
                    {event.played}
                    {' '}
                    {event.played === 1 ? 'match' : 'matches'}
                    {' played: '}
                    {event.won}
                    W
                    {' '}
                    {event.drawn}
                    D
                    {' '}
                    {event.lost}
                    L
                  </span>
                  <span>
                    <Icon path="icons/currency_coin.png" />
                    {' +'}
                    {event.coins}
                    {' coins'}
                  </span>
                  {event.promotedTo ? <span className="text-primary">{`Promoted to ${leagueName(event.promotedTo)}!`}</span> : null}
                  {event.skipped > 0 ? <span className="text-muted">{`${event.skipped} older matches were not played while you were away.`}</span> : null}
                </li>
              )
            }
            if (event.type === 'packs') {
              return (
                <li key={event.type}>
                  <Icon path="icons/currency_pack.png" />
                  {` ${event.gained} ${event.gained === 1 ? 'pack' : 'packs'} on the shelf`}
                </li>
              )
            }
            return (
              <li key={event.type}>
                <Icon path="icons/currency_gem.png" />
                {` +${event.amount} gems today`}
              </li>
            )
          })}
        </ul>
        <button type="button" className="btn btn-primary min-h-11 w-full font-display text-xs" onClick={onClose}>Let's go</button>
      </div>
    </div>
  )
}
