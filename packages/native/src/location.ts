import { Geolocation, type Position } from '@capacitor/geolocation'
import { errorMessage } from './errors'
import { isNativePlatform } from './platform'

/** Needs `capabilities.location` in app.meta.ts and `@capacitor/geolocation` in the app's package.json. */

export interface Coordinates {
  latitude: number
  longitude: number
  /** Metres. */
  accuracy: number
  /** Milliseconds since the epoch, from the device. Never trust it for anything the server decides. */
  timestamp: number
}

export type LocationResult =
  | { status: 'ok', coords: Coordinates }
  | { status: 'denied' }
  | { status: 'unavailable', reason: string }

export interface LocationOptions {
  /** GPS-level accuracy. Slower and uses more battery; city-level is enough for most features. Default false. */
  precise?: boolean
  /** Give up after this many milliseconds. Default 15 s. */
  timeoutMs?: number
  /** Accept a cached fix up to this old. Default 60 s. */
  maxAgeMs?: number
}

function toCoordinates(position: Position): Coordinates {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    timestamp: position.timestamp,
  }
}

function positionOptions(options: LocationOptions) {
  return { enableHighAccuracy: options.precise ?? false, timeout: options.timeoutMs ?? 15_000, maximumAge: options.maxAgeMs ?? 60_000 }
}

/** `prompt` means the app may ask. Check before showing an "Allow location" explanation. */
export async function checkLocationPermission(): Promise<'granted' | 'denied' | 'prompt'> {
  try {
    const { location, coarseLocation } = await Geolocation.checkPermissions()
    const status = location === 'granted' || coarseLocation === 'granted' ? 'granted' : location
    return status === 'granted' || status === 'denied' ? status : 'prompt'
  }
  catch {
    return 'prompt'
  }
}

function isDenied(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code: unknown }).code : undefined
  // The browser's PERMISSION_DENIED is code 1; the plugins say so in words.
  return code === 1 || /denied|permission/i.test(errorMessage(error))
}

/**
 * One position fix. Asks for permission the first time (the OS prompt, with the wording from app.meta.ts). Location
 * is only read while the app is open; background location needs a different plugin and a strong reason at review.
 * Never throws.
 */
export async function getCurrentLocation(options: LocationOptions = {}): Promise<LocationResult> {
  try {
    if (isNativePlatform()) {
      const permission = await Geolocation.requestPermissions({ permissions: [options.precise ? 'location' : 'coarseLocation'] })
      if (permission.location !== 'granted' && permission.coarseLocation !== 'granted')
        return { status: 'denied' }
    }
    // On the web, asking for a position is what shows the browser's prompt.
    return { status: 'ok', coords: toCoordinates(await Geolocation.getCurrentPosition(positionOptions(options))) }
  }
  catch (error) {
    return isDenied(error) ? { status: 'denied' } : { status: 'unavailable', reason: errorMessage(error) }
  }
}

/**
 * Calls back with each new position while the app is open. Returns a function that stops watching; call it on
 * unmount, since a forgotten watch keeps the GPS on.
 */
export function watchLocation(onChange: (result: LocationResult) => void, options: LocationOptions = {}): () => void {
  let stopped = false
  const id = Geolocation.watchPosition(positionOptions(options), (position, error) => {
    if (stopped)
      return
    if (position)
      onChange({ status: 'ok', coords: toCoordinates(position) })
    else if (error)
      onChange(isDenied(error) ? { status: 'denied' } : { status: 'unavailable', reason: errorMessage(error) })
  }).catch((error: unknown) => {
    onChange(isDenied(error) ? { status: 'denied' } : { status: 'unavailable', reason: errorMessage(error) })
    return null
  })

  return () => {
    stopped = true
    void id.then(callbackId => callbackId ? Geolocation.clearWatch({ id: callbackId }) : undefined).catch(() => {})
  }
}
