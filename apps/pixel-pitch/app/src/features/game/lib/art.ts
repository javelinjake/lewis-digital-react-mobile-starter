import { BASE_KITS } from '@ld/pixel-pitch-core'

// Every sprite the game draws, fingerprinted by Vite. Only URLs are bundled here; images load when first drawn.
const files = import.meta.glob('/src/assets/game/**/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

/** URL of a sprite by its path under `src/assets/game`, e.g. `icons/currency_coin.png`. */
export function art(path: string): string {
  const url = files[`/src/assets/game/${path}`]
  if (!url)
    throw new Error(`No sprite at ${path}. Run art:build after adding it to the asset pack.`)
  return url
}

/** The kits a club can choose at onboarding: primary and secondary, drawn into the key-coloured templates. */
export const KIT_COLOURS: ReadonlyArray<readonly [primary: string, secondary: string, name: string]> = BASE_KITS.map(kit => [kit.primary, kit.secondary, kit.name] as const)
