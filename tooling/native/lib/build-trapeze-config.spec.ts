import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveCapabilities } from '../../../packages/config-capacitor/src/identity'
import { buildTrapezeConfig, deriveBuildNumber } from './build-trapeze-config'

const identity = {
  appId: 'uk.co.lewisdigital.acme',
  name: 'Acme',
  version: '1.2.3',
  buildNumber: 42,
  usage: { camera: 'Camera', photos: 'Photos', location: 'Location', faceId: 'Face ID' },
}

interface ManifestEntry { target?: string, attrs?: Record<string, string>, inject?: string, delete?: string }
type IosTarget = {
  plist: Array<{ replace: boolean, entries: Array<Record<string, unknown>> }>
  entitlements?: Array<Record<string, unknown>>
  buildSettings?: Record<string, string>
} & Record<string, unknown>

function ios(config: ReturnType<typeof buildTrapezeConfig>) {
  return (config.platforms.ios.targets as { App: IosTarget }).App
}

function manifest(config: ReturnType<typeof buildTrapezeConfig>) {
  return config.platforms.android.manifest as ManifestEntry[]
}

function injected(config: ReturnType<typeof buildTrapezeConfig>) {
  return manifest(config).filter(entry => entry.inject).map(entry => entry.inject).join('\n')
}

function info(config: ReturnType<typeof buildTrapezeConfig>) {
  return Object.assign({}, ...ios(config).plist.map(block => block.entries[0])) as Record<string, unknown>
}

describe('buildTrapezeConfig', () => {
  it('maps identity to both platforms', () => {
    const config = buildTrapezeConfig(identity)
    const target = ios(config)

    assert.equal(target.bundleId, 'uk.co.lewisdigital.acme')
    assert.equal(target.displayName, 'Acme')
    assert.equal(target.version, '1.2.3')
    assert.equal(target.buildNumber, 42)
    assert.equal(config.platforms.android.packageName, 'uk.co.lewisdigital.acme')
    assert.equal(config.platforms.android.versionCode, 42)
    assert.equal(target.entitlements, undefined)
    assert.equal(injected(config), '')
  })

  it('turns Android cloud backup off and skips the export-compliance question', () => {
    const config = buildTrapezeConfig(identity)
    assert.equal(manifest(config).find(entry => entry.target === 'manifest/application')?.attrs?.['android:allowBackup'], 'false')
    assert.equal(info(config).ITSAppUsesNonExemptEncryption, false)
  })

  it('adds universal/app link wiring when a hostname is set', () => {
    const config = buildTrapezeConfig({ ...identity, hostname: 'app.acme.test' })

    assert.deepEqual(ios(config).entitlements?.[0]?.['com.apple.developer.associated-domains'], [
      'applinks:app.acme.test',
      'webcredentials:app.acme.test',
    ])
    assert.match(injected(config), /android:host="app\.acme\.test"/)
  })

  it('deletes every node it manages before adding any, so a second run does not duplicate them', () => {
    const config = buildTrapezeConfig({ ...identity, hostname: 'app.acme.test', capabilities: resolveCapabilities({ location: true }) })
    const entries = manifest(config)
    const deleteAt = entries.findIndex(entry => entry.delete)
    const firstInject = entries.findIndex(entry => entry.inject)

    assert.ok(deleteAt >= 0 && deleteAt < firstInject)
    // Off capabilities are deleted too, so turning one off removes its permission.
    assert.match(entries[deleteAt].delete!, /intent-filter\[@android:autoVerify="true"\]/)
    assert.match(entries[deleteAt].delete!, /ACCESS_FINE_LOCATION/)
    assert.match(entries[deleteAt].delete!, /USE_BIOMETRIC/)
  })

  it('adds nothing for capabilities that are off', () => {
    const config = buildTrapezeConfig({ ...identity, capabilities: resolveCapabilities({}) })
    const plist = info(config)

    assert.equal(injected(config), '')
    assert.equal(plist.NSLocationWhenInUseUsageDescription, undefined)
    assert.equal(plist.NSFaceIDUsageDescription, undefined)
    assert.equal(plist.UIBackgroundModes, undefined)
  })

  it('writes permissions, strings and entitlements for each capability that is on', () => {
    const config = buildTrapezeConfig({
      ...identity,
      capabilities: resolveCapabilities({ push: true, location: true, biometrics: true, barcode: true }),
    })
    const plist = info(config)
    const xml = injected(config)

    assert.equal(plist.NSLocationWhenInUseUsageDescription, 'Location')
    assert.equal(plist.NSFaceIDUsageDescription, 'Face ID')
    assert.deepEqual(plist.UIBackgroundModes, ['remote-notification'])
    assert.equal(ios(config).entitlements?.[0]?.['aps-environment'], 'development')
    for (const name of ['POST_NOTIFICATIONS', 'ACCESS_FINE_LOCATION', 'USE_BIOMETRIC', 'CAMERA'])
      assert.match(xml, new RegExp(`android\\.permission\\.${name}`))
    assert.match(xml, /com\.google\.mlkit\.vision\.DEPENDENCIES/)
    assert.match(xml, /android:required="false"/)
  })
})

describe('orientation', () => {
  it('locks a portrait phone-only app on both platforms', () => {
    const config = buildTrapezeConfig({ ...identity, orientation: 'portrait', tablet: false })
    const target = ios(config)
    const block = target.plist.find(entry => 'UISupportedInterfaceOrientations' in entry.entries[0])!
    const entries = block.entries[0]

    // Replaced, not merged: merging kept the template's landscape orientations.
    assert.equal(block.replace, true)
    assert.equal(target.buildSettings?.TARGETED_DEVICE_FAMILY, '1')
    assert.deepEqual(entries.UISupportedInterfaceOrientations, ['UIInterfaceOrientationPortrait'])
    assert.deepEqual(entries['UISupportedInterfaceOrientations~ipad'], ['UIInterfaceOrientationPortrait'])
    assert.equal(manifest(config).find(entry => entry.attrs?.['android:screenOrientation'])?.attrs?.['android:screenOrientation'], 'portrait')
  })

  it('keeps a portrait app portrait on the phone but lets it rotate on iPad', () => {
    const config = buildTrapezeConfig({ ...identity, orientation: 'portrait', tablet: true })
    const target = ios(config)
    const entries = target.plist.find(entry => 'UISupportedInterfaceOrientations' in entry.entries[0])!.entries[0]

    assert.deepEqual(target.buildSettings, { TARGETED_DEVICE_FAMILY: '1,2' })
    assert.deepEqual(entries.UISupportedInterfaceOrientations, ['UIInterfaceOrientationPortrait'])
    assert.equal((entries['UISupportedInterfaceOrientations~ipad'] as string[]).length, 4)
  })

  it('lets a tablet app rotate fully on iPad while the phone follows the lock', () => {
    const config = buildTrapezeConfig({ ...identity, orientation: 'any', tablet: true })
    const target = ios(config)
    const entries = target.plist.find(entry => 'UISupportedInterfaceOrientations' in entry.entries[0])!.entries[0]

    assert.deepEqual(target.buildSettings, { TARGETED_DEVICE_FAMILY: '1,2' })
    assert.equal((entries['UISupportedInterfaceOrientations~ipad'] as string[]).length, 4)
    assert.equal(manifest(config).some(entry => entry.attrs?.['android:screenOrientation']), false)
  })
})

describe('deriveBuildNumber', () => {
  it('is monotonic and within Android limits', () => {
    const earlier = deriveBuildNumber(new Date('2026-01-01T00:00:00Z'))
    const later = deriveBuildNumber(new Date('2026-01-01T00:01:00Z'))

    assert.equal(later - earlier, 1)
    assert.ok(deriveBuildNumber(new Date('2100-01-01T00:00:00Z')) < 2_100_000_000)
  })
})
