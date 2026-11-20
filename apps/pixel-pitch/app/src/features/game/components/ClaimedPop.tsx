import type { ClaimAllResult, GameResponse } from '@ld/pixel-pitch-core'
import { Link } from 'react-router'
import { Icon } from './sprites'

export type Claimed = GameResponse & ClaimAllResult

/** What a claim paid, with the next thing to do: open the packs it put on the shelf, or just carry on. */
export function ClaimedPop({ result, onClose }: { result: Claimed, onClose: () => void }) {
  const lines = [
    { key: 'coins', icon: 'icons/currency_coin.png', text: `+${result.coins.toLocaleString('en-GB')} coins`, show: result.coins > 0 },
    { key: 'gems', icon: 'icons/currency_gem.png', text: `+${result.gems} gems`, show: result.gems > 0 },
    { key: 'tokens', icon: 'icons/currency_token.png', text: `+${result.tokens} tokens`, show: result.tokens > 0 },
    { key: 'packs', icon: 'icons/currency_pack.png', text: `+${result.packs} ${result.packs === 1 ? 'pack' : 'packs'} on the shelf`, show: result.packs > 0 },
    { key: 'star', icon: 'icons/currency_star.png', text: `+${result.starPacks} Star ${result.starPacks === 1 ? 'pack' : 'packs'}`, show: result.starPacks > 0 },
  ].filter(line => line.show)
  const toOpen = result.club.state.idle.shelfPacks + result.club.state.starPacks

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6" role="dialog" aria-modal="true" aria-label="Claimed">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 border-2 border-primary bg-base-100 p-5">
        <h2 className="text-primary">{`Claimed ${result.items} ${result.items === 1 ? 'reward' : 'rewards'}`}</h2>
        <ul className="flex w-full flex-col gap-2 text-lg">
          {lines.map(line => (
            <li key={line.key}>
              <Icon path={line.icon} />
              {` ${line.text}`}
            </li>
          ))}
        </ul>
        {toOpen > 0
          ? (
              <>
                <Link to="/packs" className="btn btn-primary min-h-12 w-full font-display text-xs" onClick={onClose}>{`Open packs (${toOpen})`}</Link>
                <button type="button" className="btn btn-ghost min-h-11 w-full" onClick={onClose}>Not now</button>
              </>
            )
          : <button type="button" className="btn btn-primary min-h-12 w-full font-display text-xs" onClick={onClose}>Nice</button>}
      </div>
    </div>
  )
}
