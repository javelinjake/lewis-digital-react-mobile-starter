import { beforeEach, describe, expect, it, vi } from 'vitest'

/** The wrappers turn each plugin's errors and enums into small results the app can switch on. */
const state = vi.hoisted(() => ({
  native: true,
  android: false,
  updateInfo: {} as Record<string, unknown>,
  authenticateError: undefined as unknown,
  preloaded: [] as Array<Record<string, unknown>>,
}))

vi.mock('../src/platform', () => ({ isNativePlatform: () => state.native, isAndroid: () => state.android }))

vi.mock('@capawesome/capacitor-app-update', () => ({
  AppUpdateAvailability: { UNKNOWN: 0, UPDATE_NOT_AVAILABLE: 1, UPDATE_AVAILABLE: 2, UPDATE_IN_PROGRESS: 3 },
  AppUpdateResultCode: { OK: 0 },
  AppUpdate: { getAppUpdateInfo: async () => state.updateInfo, openAppStore: async () => {} },
}))

vi.mock('@aparajita/capacitor-biometric-auth', () => ({
  BiometryType: { none: 0, touchId: 1, faceId: 2, fingerprintAuthentication: 3, faceAuthentication: 4, irisAuthentication: 5 },
  BiometryErrorType: {
    userCancel: 'userCancel',
    appCancel: 'appCancel',
    systemCancel: 'systemCancel',
    userFallback: 'userFallback',
    biometryNotAvailable: 'biometryNotAvailable',
    biometryNotEnrolled: 'biometryNotEnrolled',
    passcodeNotSet: 'passcodeNotSet',
    noDeviceCredential: 'noDeviceCredential',
  },
  BiometricAuth: {
    checkBiometry: async () => ({ isAvailable: true, biometryType: 2 }),
    authenticate: async () => {
      if (state.authenticateError)
        throw state.authenticateError
    },
  },
}))

vi.mock('@capacitor-community/native-audio', () => ({
  NativeAudio: {
    configure: async () => {},
    preload: async (options: Record<string, unknown>) => {
      state.preloaded.push(options)
    },
  },
}))

const { isCancellation } = await import('../src/errors')
const { checkStoreUpdate } = await import('../src/store-update')
const { confirmWithBiometrics, getBiometryInfo } = await import('../src/biometrics')
const { createSoundPlayer } = await import('../src/audio')

beforeEach(() => {
  state.native = true
  state.android = false
  state.authenticateError = undefined
  state.preloaded = []
})

describe('isCancellation', () => {
  it('recognises the ways plugins say the person backed out', () => {
    expect(isCancellation(new Error('User cancelled photos app'))).toBe(true)
    expect(isCancellation(new Error('pickFiles canceled.'))).toBe(true)
    expect(isCancellation({ code: 'userCancel', message: '' })).toBe(true)
    expect(isCancellation(new Error('Camera not available'))).toBe(false)
  })
})

describe('checkStoreUpdate', () => {
  it('reports an available update and whether Play can install it in the app', async () => {
    state.android = true
    state.updateInfo = { updateAvailability: 2, currentVersionName: '1.0.0', availableVersionName: '1.1.0', immediateUpdateAllowed: true }
    expect(await checkStoreUpdate()).toEqual({ status: 'available', currentVersion: '1.0.0', availableVersion: '1.1.0', inAppUpdateAllowed: true })
  })

  it('never offers an in-app install on iOS', async () => {
    state.updateInfo = { updateAvailability: 2, currentVersionName: '1.0.0', immediateUpdateAllowed: true }
    expect((await checkStoreUpdate()).inAppUpdateAllowed).toBe(false)
  })

  it('is unknown on the web', async () => {
    state.native = false
    expect((await checkStoreUpdate()).status).toBe('unknown')
  })
})

describe('biometrics', () => {
  it('names the kind of biometry', async () => {
    expect(await getBiometryInfo()).toEqual({ available: true, kind: 'face' })
  })

  it('maps the plugin error codes', async () => {
    state.authenticateError = { code: 'userCancel' }
    expect(await confirmWithBiometrics('Unlock')).toBe('cancelled')
    state.authenticateError = { code: 'biometryNotEnrolled' }
    expect(await confirmWithBiometrics('Unlock')).toBe('unavailable')
    state.authenticateError = { code: 'authenticationFailed' }
    expect(await confirmWithBiometrics('Unlock')).toBe('failed')
    state.authenticateError = undefined
    expect(await confirmWithBiometrics('Unlock')).toBe('confirmed')
  })

  it('is unavailable on the web', async () => {
    state.native = false
    expect(await confirmWithBiometrics('Unlock')).toBe('unavailable')
  })
})

describe('createSoundPlayer', () => {
  it('loads from the bundle on native and from the site on the web, once per id', async () => {
    const native = createSoundPlayer()
    await native.load('coin', '/sounds/coin.mp3')
    await native.load('coin', '/sounds/coin.mp3')
    state.native = false
    await createSoundPlayer().load('coin', 'sounds/coin.mp3')

    expect(state.preloaded).toMatchObject([
      { assetId: 'coin', assetPath: 'public/sounds/coin.mp3', isUrl: false },
      { assetId: 'coin', assetPath: '/sounds/coin.mp3', isUrl: true },
    ])
  })
})
