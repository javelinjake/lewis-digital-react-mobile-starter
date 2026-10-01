import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildTrapezeConfig, deriveBuildNumber } from './build-trapeze-config'

const identity = {
  appId: 'uk.co.lewisdigital.acme',
  name: 'Acme',
  version: '1.2.3',
  buildNumber: 42,
  usage: { camera: 'Camera', photos: 'Photos' },
}

describe('buildTrapezeConfig', () => {
  it('maps identity to both platforms', () => {
    const config = buildTrapezeConfig(identity)
    const ios = (config.platforms.ios.targets as { App: Record<string, unknown> }).App

    assert.equal(ios.bundleId, 'uk.co.lewisdigital.acme')
    assert.equal(ios.displayName, 'Acme')
    assert.equal(ios.version, '1.2.3')
    assert.equal(ios.buildNumber, 42)
    assert.equal(config.platforms.android.packageName, 'uk.co.lewisdigital.acme')
    assert.equal(config.platforms.android.versionCode, 42)
    assert.equal(ios.entitlements, undefined)
    assert.equal(config.platforms.android.manifest, undefined)
  })

  it('adds universal/app link wiring when a hostname is set', () => {
    const config = buildTrapezeConfig({ ...identity, hostname: 'app.acme.test' })
    const ios = (config.platforms.ios.targets as { App: Record<string, unknown> }).App
    const entitlements = ios.entitlements as Array<Record<string, string[]>>
    const manifest = config.platforms.android.manifest as Array<{ inject: string }>

    assert.deepEqual(entitlements[0]?.['com.apple.developer.associated-domains'], [
      'applinks:app.acme.test',
      'webcredentials:app.acme.test',
    ])
    assert.match(manifest[0]?.inject ?? '', /android:host="app\.acme\.test"/)
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
