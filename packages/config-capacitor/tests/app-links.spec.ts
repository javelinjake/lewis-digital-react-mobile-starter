import { describe, expect, it } from 'vitest'
import { buildAppLinkFiles } from '../src/app-links'

const meta = { name: 'Acme', shortName: 'Acme', appId: 'uk.co.acme' }

describe('buildAppLinkFiles', () => {
  it('writes nothing until the team id and fingerprints exist', () => {
    expect(buildAppLinkFiles(meta)).toEqual({})
  })

  it('lists every environment\'s bundle id for Universal Links and password autofill', () => {
    const files = buildAppLinkFiles({ ...meta, appleTeamId: 'ABCDE12345' })
    const aasa = JSON.parse(files['.well-known/apple-app-site-association'])
    const ids = ['ABCDE12345.uk.co.acme', 'ABCDE12345.uk.co.acme.staging', 'ABCDE12345.uk.co.acme.dev']
    expect(aasa.applinks.details[0].appIDs).toEqual(ids)
    expect(aasa.webcredentials.apps).toEqual(ids)
    expect(files['.well-known/assetlinks.json']).toBeUndefined()
  })

  it('lists only the Android apps that have a signing fingerprint', () => {
    const files = buildAppLinkFiles({ ...meta, environments: { prod: { androidSha256: ['AA:BB'] } } })
    const links = JSON.parse(files['.well-known/assetlinks.json'])
    expect(links).toHaveLength(1)
    expect(links[0].target).toEqual({ namespace: 'android_app', package_name: 'uk.co.acme', sha256_cert_fingerprints: ['AA:BB'] })
  })
})
