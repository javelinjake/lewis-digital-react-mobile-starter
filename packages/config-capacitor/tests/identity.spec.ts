import { describe, expect, it } from 'vitest'
import { resolveAppEnv, resolveIdentity } from '../src/identity'

const meta = { name: 'Pixel Pitch', shortName: 'Pitch', appId: 'uk.co.lewisdigital.pixelpitch', hostname: 'pixelpitch.app' }

describe('resolveAppEnv', () => {
  it('defaults to prod so a forgotten variable cannot ship a dev-named build', () => {
    expect(resolveAppEnv(undefined)).toBe('prod')
    expect(resolveAppEnv('')).toBe('prod')
  })

  it('rejects anything it does not know', () => {
    expect(() => resolveAppEnv('production')).toThrow('APP_ENV must be one of')
  })
})

describe('resolveIdentity', () => {
  it('gives each environment its own bundle id and name, so all three install side by side', () => {
    expect(resolveIdentity(meta, 'prod')).toMatchObject({ appId: 'uk.co.lewisdigital.pixelpitch', name: 'Pixel Pitch' })
    expect(resolveIdentity(meta, 'staging')).toMatchObject({ appId: 'uk.co.lewisdigital.pixelpitch.staging', name: 'Pixel Pitch Staging' })
    expect(resolveIdentity(meta, 'dev')).toMatchObject({ appId: 'uk.co.lewisdigital.pixelpitch.dev', name: 'Pixel Pitch Dev' })
  })

  it('takes the api address and any overrides from the environment entry', () => {
    const result = resolveIdentity({ ...meta, environments: { staging: { apiUrl: 'https://api-staging.example.com', appIdSuffix: '.beta', nameSuffix: ' Beta' } } }, 'staging')
    expect(result).toMatchObject({ appId: 'uk.co.lewisdigital.pixelpitch.beta', name: 'Pixel Pitch Beta', apiUrl: 'https://api-staging.example.com' })
  })

  it('defaults to any orientation and tablet support, and passes explicit choices through', () => {
    expect(resolveIdentity(meta)).toMatchObject({ orientation: 'any', tablet: true })
    expect(resolveIdentity({ ...meta, orientation: 'portrait', tablet: false })).toMatchObject({ orientation: 'portrait', tablet: false })
  })
})
