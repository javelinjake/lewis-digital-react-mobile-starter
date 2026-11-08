import { describe, expect, it } from 'vitest'
import { buildAllowedOrigins } from '../../src/origins'

describe('buildAllowedOrigins', () => {
  it('includes the web origins and both native WebView origins for the app hostname', () => {
    const origins = buildAllowedOrigins({ appOrigins: 'https://app.example.com/, https://staging.example.com', hostname: 'app.example.com' })
    expect(origins).toEqual(expect.arrayContaining([
      'https://app.example.com',
      'https://staging.example.com',
      'capacitor://app.example.com',
    ]))
  })

  it('falls back to the default Capacitor localhost origins', () => {
    expect(buildAllowedOrigins()).toEqual(['capacitor://localhost', 'https://localhost'])
  })

  it('adds local dev servers only when asked', () => {
    expect(buildAllowedOrigins({ hostname: 'x.example.com' })).not.toContain('http://localhost:5173')
    expect(buildAllowedOrigins({ hostname: 'x.example.com', development: true })).toContain('http://localhost:5173')
  })

  it('never lists a wildcard and has no duplicates', () => {
    const origins = buildAllowedOrigins({ appOrigins: 'https://a.com,https://a.com', hostname: 'a.com' })
    expect(origins).not.toContain('*')
    expect(new Set(origins).size).toBe(origins.length)
  })
})
