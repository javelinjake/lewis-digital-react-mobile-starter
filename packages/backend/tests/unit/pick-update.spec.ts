import type { BundleRow } from '../../src/ota/pick-update'
import { describe, expect, it } from 'vitest'
import { pickUpdate } from '../../src/ota/pick-update'

function bundle(overrides: Partial<BundleRow>): BundleRow {
  return {
    appId: 'uk.co.acme',
    nativeVersion: '1.2.0',
    version: '1.2.0+100',
    url: 'https://cdn.example.com/a.zip',
    checksum: 'a'.repeat(64),
    active: true,
    createdAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  }
}

const check = { app_id: 'uk.co.acme', version_build: '1.2.0', version_name: 'builtin', platform: 'ios' }

describe('pickUpdate', () => {
  it('offers the newest active bundle built for this shell', () => {
    const bundles = [bundle({}), bundle({ version: '1.2.0+200', createdAt: '2026-11-02T00:00:00.000Z' }), bundle({ version: '1.2.0+300', createdAt: '2026-11-03T00:00:00.000Z', active: false })]
    expect(pickUpdate(check, bundles)).toMatchObject({ version: '1.2.0+200', url: 'https://cdn.example.com/a.zip' })
  })

  it('never offers a bundle to a shell with another store version, or another app', () => {
    expect(pickUpdate({ ...check, version_build: '1.1.0' }, [bundle({})])).toMatchObject({ kind: 'up_to_date' })
    expect(pickUpdate({ ...check, app_id: 'uk.co.acme.staging' }, [bundle({})])).toMatchObject({ kind: 'up_to_date' })
  })

  it('says up to date when the device already runs the latest', () => {
    expect(pickUpdate({ ...check, version_name: '1.2.0+100' }, [bundle({})])).toMatchObject({ kind: 'up_to_date' })
  })

  it('sends a device back to the store bundle when nothing is live for it any more', () => {
    expect(pickUpdate({ ...check, version_name: '1.2.0+100' }, [bundle({ active: false })])).toEqual({ version: 'builtin' })
    expect(pickUpdate(check, [])).toMatchObject({ kind: 'up_to_date' })
  })

  it('rejects a check without the app and shell version', () => {
    expect(pickUpdate({}, [bundle({})])).toMatchObject({ kind: 'failed' })
  })
})
