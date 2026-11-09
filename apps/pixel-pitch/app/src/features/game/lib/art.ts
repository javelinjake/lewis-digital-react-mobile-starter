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
export const KIT_COLOURS: ReadonlyArray<readonly [primary: string, secondary: string, name: string]> = [
  ['#e2483d', '#f4f4f4', 'Red and white'],
  ['#3f7fd6', '#f4f4f4', 'Blue and white'],
  ['#ffd23f', '#1b1f3b', 'Yellow and navy'],
  ['#3fa34d', '#f4f4f4', 'Green and white'],
  ['#10122a', '#ffd23f', 'Black and yellow'],
  ['#ff4f79', '#1b1f3b', 'Pink and navy'],
  ['#ff9f43', '#10122a', 'Orange and black'],
  ['#5ec8ff', '#1b1f3b', 'Sky and navy'],
]
