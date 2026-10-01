import { describe, expect, it } from 'vitest'
import { assetUrl, prepareHtml } from '@/lib/assets'
import { contentSteps, formatLongDate, greetingFor, parseMinutes, parseSeconds, scaleAmount, splitLines } from '@/lib/content-text'
import { rememberAccessToken } from '@/lib/directus/client'
import { emptyFamilyState, readFamilyState, updateFamilyState, writeFamilyState } from '@/lib/family-data'

describe('content text', () => {
  it('splits workout text into steps and keeps a single block', () => {
    expect(splitLines('15 burpees\n20 squats')).toEqual(['15 burpees', '20 squats'])
    expect(splitLines('Keep going')).toEqual(['Keep going'])
    expect(splitLines('  ')).toEqual([])
    expect(contentSteps('<ul><li>15 burpees</li><li>20 squats</li></ul>')).toEqual(['15 burpees', '20 squats'])
    expect(contentSteps('<p>Keep going</p>')).toEqual(['Keep going'])
  })

  it('parses minutes, seconds, and scaled amounts', () => {
    expect(parseMinutes('12 min')).toBe(12)
    expect(parseSeconds('2-minute warm-up')).toBe(120)
    expect(parseSeconds('30 seconds')).toBe(30)
    expect(parseSeconds('Burpees (30s)')).toBe(30)
    expect(scaleAmount('250 g noodles', 2)).toBe('500 g noodles')
    expect(greetingFor(new Date('2026-09-30T20:00:00'))).toBe('evening')
    expect(formatLongDate('2026-09-30T12:00:00')).toContain('September')
  })
})

describe('directus assets', () => {
  it('adds the signed-in token and rewrites html images', () => {
    rememberAccessToken('session-token')
    const url = assetUrl('8690aa20-3813-4de3-91ef-d84961cb2e14')
    expect(url).toContain('/assets/8690aa20-3813-4de3-91ef-d84961cb2e14')
    expect(url).toContain('access_token=session-token')
    expect(url).toContain('key=600w')

    const html = prepareHtml('<p>Warm up</p><img src="/assets/file-1"><script>alert(1)</script>')
    expect(html).toContain('Warm up')
    expect(html).toContain('access_token=session-token')
    expect(html).toContain('/assets/file-1')
    expect(html).not.toContain('script')
  })
})

describe('family storage', () => {
  it('saves a journal note for the signed-in user only', () => {
    writeFamilyState('user-a', emptyFamilyState())
    updateFamilyState('user-a', current => ({
      ...current,
      journal: [{ date: '2026-09-30', body: 'We laughed at dinner.' }],
    }))

    expect(readFamilyState('user-a').journal).toEqual([{ date: '2026-09-30', body: 'We laughed at dinner.' }])
    expect(readFamilyState('user-b').journal).toEqual([])
  })
})
