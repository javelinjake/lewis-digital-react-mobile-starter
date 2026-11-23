import { BiometricAuth, BiometryErrorType, BiometryType } from '@aparajita/capacitor-biometric-auth'
import { isNativePlatform } from './platform'

/** Needs `capabilities.biometrics` in app.meta.ts and `@aparajita/capacitor-biometric-auth` in the app's package.json. */

export type BiometryKind = 'face' | 'fingerprint' | 'iris' | 'none'

export interface BiometryInfo {
  /** Hardware present and the user has enrolled. */
  available: boolean
  kind: BiometryKind
}

const kinds: Record<BiometryType, BiometryKind> = {
  [BiometryType.none]: 'none',
  [BiometryType.touchId]: 'fingerprint',
  [BiometryType.faceId]: 'face',
  [BiometryType.fingerprintAuthentication]: 'fingerprint',
  [BiometryType.faceAuthentication]: 'face',
  [BiometryType.irisAuthentication]: 'iris',
}

/** What the device offers, to label a button "Use Face ID" or hide the option. Unavailable on the web. */
export async function getBiometryInfo(): Promise<BiometryInfo> {
  if (!isNativePlatform())
    return { available: false, kind: 'none' }
  try {
    const result = await BiometricAuth.checkBiometry()
    return { available: result.isAvailable, kind: kinds[result.biometryType] ?? 'none' }
  }
  catch {
    return { available: false, kind: 'none' }
  }
}

export type BiometricResult = 'confirmed' | 'cancelled' | 'failed' | 'unavailable'

const cancelled = new Set<string>([BiometryErrorType.userCancel, BiometryErrorType.appCancel, BiometryErrorType.systemCancel, BiometryErrorType.userFallback])
const unavailable = new Set<string>([BiometryErrorType.biometryNotAvailable, BiometryErrorType.biometryNotEnrolled, BiometryErrorType.passcodeNotSet, BiometryErrorType.noDeviceCredential])

/**
 * Asks the person to confirm with Face ID, Touch ID or a fingerprint, falling back to the device passcode. This is
 * a local check that the phone's owner is present, for example before showing the app after a resume. It proves
 * nothing to the server: never use it in place of signing in. Never throws.
 */
export async function confirmWithBiometrics(reason: string): Promise<BiometricResult> {
  if (!isNativePlatform())
    return 'unavailable'
  try {
    await BiometricAuth.authenticate({ reason, allowDeviceCredential: true, androidTitle: reason })
    return 'confirmed'
  }
  catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : ''
    if (cancelled.has(code))
      return 'cancelled'
    if (unavailable.has(code))
      return 'unavailable'
    return 'failed'
  }
}
