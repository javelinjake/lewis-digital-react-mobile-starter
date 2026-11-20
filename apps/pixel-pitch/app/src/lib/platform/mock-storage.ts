/**
 * Where mock mode keeps its sign-in and club. Tests and Lighthouse use sessionStorage, so every run starts empty.
 * A playtest build (`VITE_MOCK_PERSIST=1`: offline, on a phone) uses localStorage, so the club survives the app
 * being closed. Mock mode only: a live build keeps nothing of the game on the device.
 */
export function mockStorage(): Storage {
  return import.meta.env.VITE_MOCK_PERSIST === '1' ? localStorage : sessionStorage
}

/** True in a playtest build: Settings shows skip-ahead controls, and there is no offline banner (it runs offline). */
export const isPlaytestBuild = import.meta.env.VITE_DATA_MODE === 'mock' && import.meta.env.VITE_MOCK_PERSIST === '1'
