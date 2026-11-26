// Every sprite the game draws, fingerprinted by Vite. Only URLs are bundled here; images load when first drawn.
const files = import.meta.glob('/src/assets/game/**/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

/** URL of a sprite by its path under `src/assets/game`, e.g. `icons/currency_coin.png`. */
export function art(path: string): string {
  const url = files[`/src/assets/game/${path}`]
  if (!url)
    throw new Error(`No sprite at ${path}. Run art:build after adding it to the asset pack.`)
  return url
}

/** The kits a club can choose at onboarding (the free ones; the server checks): primary, secondary and a name. */
export { FREE_KITS as KIT_COLOURS } from '@ld/pixel-pitch-core'
