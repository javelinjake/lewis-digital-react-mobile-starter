import type { GameResponse, Product } from '@ld/pixel-pitch-core'
import { BASE_KITS, benchLimit, canBuy, CREST_COUNT, energyAt, energyMax, seasonDaysLeft, wearableKits } from '@ld/pixel-pitch-core'
import { useToast } from '@ld/ui'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { telemetry } from '@/lib/telemetry'
import { formatError } from '@/utils/format-error'
import { gameApi } from '../api/game-api'
import { kitOf } from '../lib/club'
import { useServerNow } from '../lib/server-clock'
import { storeMode } from '../lib/store'
import { useGameAction } from '../mutations/use-game-action'
import { useBuy, useRestore, useStorePrices } from '../mutations/use-store'
import { useGameConfig } from '../queries/use-game'
import { RewardText } from './RewardText'
import { Crest, Icon } from './sprites'

const MODE = storeMode()

/**
 * The shop. Everything on sale is shown before it is bought, and nothing is random: packs are only ever earned by
 * playing. Money buys gems, the League Pass, the Chairman's Licence and the starter offer; gems buy time, room and looks.
 */
export function ShopScreen({ game, from }: { game: GameResponse, from: string }) {
  const config = useGameConfig()
  const toast = useToast()
  const { state } = game.club
  const now = useServerNow(game)
  const prices = useStorePrices()
  const buy = useBuy()
  const restore = useRestore()
  const onError = (error: unknown) => toast.push(formatError(error), 'error')

  useEffect(() => {
    telemetry.track('shop_viewed', { from })
  }, [from])

  const priceOf = (product: Product) => (MODE === 'store' ? prices.data?.get(product.id)?.price : product.price)
  const buyButton = (product: Product, label = 'Buy') => {
    const price = priceOf(product)
    const available = MODE !== 'unavailable' && price !== undefined
    return (
      <button
        type="button"
        className="btn btn-primary min-h-11 font-display text-xs"
        aria-label={`${label} ${product.title}${price ? ` for ${price}` : ''}`}
        disabled={!available || buy.isPending}
        onClick={() => buy.mutate(product.id, {
          onSuccess: (outcome) => {
            if (outcome === 'paid')
              toast.push(`Thank you! ${product.title} is yours.`, 'success')
            else if (outcome === 'confirming')
              toast.push('Payment received. It will reach your club in a moment.', 'info')
          },
          onError,
        })}
      >
        {price ? `${label} · ${price}` : MODE === 'store' && prices.isPending ? 'Loading price…' : label}
      </button>
    )
  }

  const products = config.shop.products
  const starter = products.find(product => product.kind === 'starter')
  const pass = products.find(product => product.kind === 'pass')
  const licence = products.find(product => product.kind === 'licence')
  const gemPacks = products.filter(product => product.kind === 'gems')
  const daysLeft = seasonDaysLeft(now, config)

  return (
    <div className="flex flex-col gap-4">
      <section className="flex items-center justify-between border-2 border-slate bg-base-100 p-3 text-lg" aria-label="Your gems">
        <span className="flex items-center gap-1">
          <Icon path="icons/currency_gem.png" label="Gems" />
          <span className="tabular-nums">{`${state.idle.gems} gems`}</span>
        </span>
        <span className="text-muted">{`+${state.idle.hasPass ? config.daily.gemsWithPass : config.daily.gems} free every day`}</span>
      </section>

      {MODE === 'unavailable'
        ? <p className="border-2 border-warning bg-base-100 p-3">Purchases are made in the Pixel Pitch app for iPhone and Android. Anything you buy there shows up here too.</p>
        : null}
      {MODE === 'pretend'
        ? <p className="border-2 border-info bg-base-100 p-3 text-muted">Playtest build: purchases are pretend and cost nothing.</p>
        : null}

      {starter && canBuy(state, starter, config, now)
        ? (
            <section className="flex flex-col gap-2 border-2 border-warning bg-base-100 p-3" aria-label="Starter offer">
              <div className="flex items-baseline justify-between">
                <h2 className="text-warning">{starter.title}</h2>
                <span className="text-muted">Once only</span>
              </div>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-lg">
                {starter.rewards.map(reward => <li key={reward.kind}><RewardText reward={reward} /></li>)}
              </ul>
              <span className="text-muted">The Star Signing lets you pick one of three named Star players. You see all three before you choose.</span>
              {buyButton(starter)}
            </section>
          )
        : null}

      {pass
        ? (
            <section className="flex flex-col gap-2 border-2 border-primary bg-base-100 p-3" aria-label="League Pass">
              <div className="flex items-baseline justify-between">
                <h2 className="text-primary">{pass.title}</h2>
                <span className="text-muted">{`This season: ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`}</span>
              </div>
              <ul className="flex list-disc flex-col gap-1 pl-5">
                <li>The premium track: a reward on every tier, two Star Signings and the season's two kits</li>
                <li>{`${config.daily.gemsWithPass} gems a day instead of ${config.daily.gems}`}</li>
                <li>{`A bigger shelf (${config.shelf.capacityWithPass} packs), ${config.cabinets.energy.maxWithPass} arcade energy, and ${config.stadium.capHoursWithPass}-hour stadium and tray`}</li>
                <li>Every premium tier you have already reached unlocks at once</li>
              </ul>
              {state.idle.hasPass
                ? <span className="text-success">Active for this season. It ends with the season and does not renew.</span>
                : buyButton(pass)}
              <Link to="/pass" className="btn btn-ghost min-h-11">See every tier ›</Link>
            </section>
          )
        : null}

      {licence
        ? (
            <section className="flex flex-col gap-2 border-2 border-slate bg-base-100 p-3" aria-label="Chairman's Licence">
              <div className="flex items-baseline justify-between">
                <h2>{licence.title}</h2>
                <span className="text-muted">Yours for good</span>
              </div>
              <ul className="flex list-disc flex-col gap-1 pl-5">
                <li>{`${config.shop.licenceBenchSlots} more places on the bench`}</li>
                <li>Change your kit and crest whenever you like, free</li>
                <li>Supports a one-person studio</li>
              </ul>
              {state.perks.licence ? <span className="text-success">You hold the Licence. Thank you.</span> : buyButton(licence)}
            </section>
          )
        : null}

      <section className="flex flex-col gap-2" aria-label="Gems">
        <h2>Gems</h2>
        <div className="grid grid-cols-2 gap-2">
          {gemPacks.map(product => (
            <div key={product.id} className="flex flex-col gap-2 border-2 border-slate bg-base-100 p-3">
              <span>{product.title}</span>
              <RewardText reward={product.rewards[0]} />
              {buyButton(product, 'Buy')}
            </div>
          ))}
        </div>
      </section>

      <GemShop game={game} onError={onError} />
      <ClubLook game={game} onError={onError} />

      <section className="flex flex-col gap-2 border-t-2 border-base-300 pt-3" aria-label="Purchases">
        {MODE === 'store'
          ? (
              <button type="button" className="btn btn-outline min-h-11" disabled={restore.isPending} onClick={() => restore.mutate(undefined, { onSuccess: () => toast.push('Purchases checked.', 'success'), onError })}>
                Restore purchases
              </button>
            )
          : null}
        <span className="text-muted">Prices include VAT. Nothing in the shop is random: packs are only ever earned by playing. Gems are spent on the things listed in this shop and nothing else.</span>
        <LegalLinks />
      </section>
    </div>
  )
}

function LegalLinks() {
  const terms = import.meta.env.VITE_TERMS_URL
  const privacy = import.meta.env.VITE_PRIVACY_URL
  if (!terms && !privacy)
    return null
  return (
    <span className="flex gap-4">
      {terms ? <a className="link" href={terms} target="_blank" rel="noreferrer">Terms of use</a> : null}
      {privacy ? <a className="link" href={privacy} target="_blank" rel="noreferrer">Privacy policy</a> : null}
    </span>
  )
}

/** What gems buy, besides an extra arcade play and a warm-up retry (offered where they are used). */
function GemShop({ game, onError }: { game: GameResponse, onError: (error: unknown) => void }) {
  const config = useGameConfig()
  const now = useServerNow(game)
  const { state } = game.club
  const refill = useGameAction(() => gameApi.refillEnergy())
  const bench = useGameAction(() => gameApi.buyBenchSlots())
  const energyFull = energyAt(state, config, now) >= energyMax(state, config)
  const benchMaxed = state.perks.benchBuys >= config.shop.benchSlotsMaxBuys
  const spent = (on: string, amount: number) => () => telemetry.track('gems_spent', { on, amount })

  return (
    <section className="flex flex-col gap-2" aria-label="Spend gems">
      <h2>Spend gems</h2>
      <div className="flex items-center justify-between gap-2 border-2 border-slate bg-base-100 p-3">
        <span className="flex flex-col">
          <span>Refill arcade energy</span>
          <span className="text-muted">{energyFull ? 'Your energy is full.' : `Back to ${energyMax(state, config)} plays now.`}</span>
        </span>
        <button type="button" className="btn btn-outline min-h-11" disabled={energyFull || refill.isPending} onClick={() => refill.mutate(undefined, { onSuccess: spent('energy', config.shop.gems.energyRefill), onError })}>
          {`${config.shop.gems.energyRefill} gems`}
        </button>
      </div>
      <div className="flex items-center justify-between gap-2 border-2 border-slate bg-base-100 p-3">
        <span className="flex flex-col">
          <span>{`+${config.shop.benchSlotsEach} bench places`}</span>
          <span className="text-muted">{`Your bench holds ${benchLimit(state, config)}.${benchMaxed ? ' That is the most it can.' : ''}`}</span>
        </span>
        <button type="button" className="btn btn-outline min-h-11" disabled={benchMaxed || bench.isPending} onClick={() => bench.mutate(undefined, { onSuccess: spent('bench', config.shop.gems.benchSlots), onError })}>
          {`${config.shop.gems.benchSlots} gems`}
        </button>
      </div>
    </section>
  )
}

/** Kits and crest. Base kits are free to own; premium kits are bought once with gems; changing costs gems unless the Licence is held. */
function ClubLook({ game, onError }: { game: GameResponse, onError: (error: unknown) => void }) {
  const config = useGameConfig()
  const { state } = game.club
  const [kitPrimary, kitSecondary] = kitOf(game)
  const [crest, setCrest] = useState(game.club.crest)
  const change = useGameAction((input: { kitId?: string, crest?: number }) => gameApi.changeIdentity(input))
  const buyKit = useGameAction((kitId: string) => gameApi.buyKit(kitId))
  const fee = state.perks.licence ? 0 : config.shop.gems.identityChange
  const feeText = fee === 0 ? 'Free with the Licence' : `${fee} gems`
  const owned = wearableKits(state, config)
  const forSale = config.cosmetics.kits.filter(kit => !state.kits.includes(kit.id))
  const wearing = (primary: string, secondary: string) => primary === kitPrimary && secondary === kitSecondary
  const busy = change.isPending || buyKit.isPending

  return (
    <section className="flex flex-col gap-3" aria-label="Club look">
      <div className="flex items-baseline justify-between">
        <h2>Club look</h2>
        <span className="text-muted">{`Change: ${feeText}`}</span>
      </div>

      <div className="grid grid-cols-4 gap-2" aria-label="Your kits">
        {owned.map(kit => (
          <button
            key={kit.id}
            type="button"
            aria-label={`Wear ${kit.name}`}
            aria-pressed={wearing(kit.primary, kit.secondary)}
            disabled={busy || wearing(kit.primary, kit.secondary)}
            className={`flex h-11 border-2 ${wearing(kit.primary, kit.secondary) ? 'border-primary' : 'border-base-300'}`}
            onClick={() => change.mutate({ kitId: kit.id }, { onSuccess: () => fee > 0 && telemetry.track('gems_spent', { on: 'kit-change', amount: fee }), onError })}
          >
            <span className="flex-1" style={{ background: kit.primary }} />
            <span className="flex-1" style={{ background: kit.secondary }} />
          </button>
        ))}
      </div>

      {forSale.length > 0
        ? (
            <ul className="flex flex-col gap-2" aria-label="Premium kits">
              {forSale.map(kit => (
                <li key={kit.id} className="flex items-center gap-3 border-2 border-slate bg-base-100 p-2">
                  <span className="flex h-11 w-16 shrink-0 border-2 border-base-300" aria-hidden="true">
                    <span className="flex-1" style={{ background: kit.primary }} />
                    <span className="flex-1" style={{ background: kit.secondary }} />
                  </span>
                  <span className="flex-1">{kit.name}</span>
                  {kit.gems === null
                    ? <span className="text-muted">League Pass reward</span>
                    : (
                        <button type="button" className="btn btn-outline min-h-11" disabled={busy || state.idle.gems < kit.gems} onClick={() => buyKit.mutate(kit.id, { onSuccess: () => telemetry.track('gems_spent', { on: 'kit', amount: kit.gems ?? 0 }), onError })}>
                          {`${kit.gems} gems`}
                        </button>
                      )}
                </li>
              ))}
            </ul>
          )
        : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1">Crest</legend>
        <div className="grid grid-cols-8 gap-1">
          {Array.from({ length: CREST_COUNT }, (_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Crest ${index + 1}`}
              aria-pressed={index === crest}
              className={`flex min-h-11 items-center justify-center border-2 ${index === crest ? 'border-primary bg-base-300' : 'border-transparent'}`}
              onClick={() => setCrest(index)}
            >
              <Crest crest={index} kit={[kitPrimary, kitSecondary]} scale={2} />
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-outline min-h-11" disabled={busy || crest === game.club.crest} onClick={() => change.mutate({ crest }, { onSuccess: () => fee > 0 && telemetry.track('gems_spent', { on: 'crest-change', amount: fee }), onError })}>
          {crest === game.club.crest ? 'This is your crest' : `Change crest · ${feeText}`}
        </button>
      </fieldset>
      <span className="sr-only">{`${BASE_KITS.length} kits are free to wear.`}</span>
    </section>
  )
}
