import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { canvasBackingSize, clubColourSwaps, createFixedStep, getAnimation, getFrame, hexToRgb, integerScale, nineSliceStyle, parseAtlas, recolorKey, swapColours } from '../src'

// Real atlases from the asset pack, so the parser is checked against the real format.
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'))

describe('parseAtlas', () => {
  it('reads the pack\'s TexturePacker hash atlases', () => {
    const atlas = parseAtlas(fixture('pack_rip'))
    expect(atlas.image).toBe('pack_rip.png')
    expect(atlas).toMatchObject({ width: 244, height: 73 })
    expect(getFrame(atlas, 'rip_0')).toEqual({ x: 0, y: 0, w: 60, h: 72 })
  })

  it('collects an animation in order, and the pack rip is the 4 frames the asset notes describe', () => {
    expect(getAnimation(parseAtlas(fixture('pack_rip')), 'rip')).toHaveLength(4)
    expect(getAnimation(parseAtlas(fixture('ball')), 'ball')).toHaveLength(4)
    const player = parseAtlas(fixture('player_anim'))
    expect(getAnimation(player, 'idle')).toHaveLength(2)
    expect(getAnimation(player, 'celebrate')).toHaveLength(2)
  })

  it('stops an animation at the first gap and does not pick up unrelated frames', () => {
    const ball = parseAtlas(fixture('ball'))
    expect(getAnimation(ball, 'ball').every(frame => frame.w > 0)).toBe(true)
    expect(() => getAnimation(ball, 'missing')).toThrow('No frames named missing_0')
  })

  it('says which frame is missing and rejects a file that is not an atlas', () => {
    expect(() => getFrame(parseAtlas(fixture('ball')), 'nope')).toThrow('No frame "nope"')
    expect(() => parseAtlas({ hello: 'world' })).toThrow('Not a TexturePacker hash atlas')
    expect(() => parseAtlas(null)).toThrow('Not a TexturePacker hash atlas')
  })
})

describe('colour swapping', () => {
  const pixels = (...rgba: number[]) => new Uint8ClampedArray(rgba)

  it('parses hex colours in both lengths and rejects junk', () => {
    expect(hexToRgb('#ff4f79')).toEqual([255, 79, 121])
    expect(hexToRgb('0f0')).toEqual([0, 255, 0])
    expect(() => hexToRgb('pink')).toThrow('Not a colour')
  })

  it('replaces the key colours with the club\'s and leaves every other pixel alone', () => {
    const source = pixels(255, 0, 0, 255, 0, 255, 0, 255, 16, 18, 42, 255)
    const result = swapColours(source, clubColourSwaps('#ffd23f', '#10122a'))
    expect(Array.from(result)).toEqual([255, 210, 63, 255, 16, 18, 42, 255, 16, 18, 42, 255])
  })

  it('does not touch transparent pixels, even ones that hold a key colour, or the input', () => {
    const source = pixels(255, 0, 0, 0)
    expect(Array.from(swapColours(source, clubColourSwaps('#112233', '#445566')))).toEqual([255, 0, 0, 0])
    const opaque = pixels(255, 0, 0, 255)
    swapColours(opaque, clubColourSwaps('#112233', '#445566'))
    expect(Array.from(opaque)).toEqual([255, 0, 0, 255])
  })

  it('gives one cache key per sprite and colour pair, ignoring hex case', () => {
    expect(recolorKey('kit_hoops', '#FFD23F', '#10122A')).toBe(recolorKey('kit_hoops', '#ffd23f', '#10122a'))
    expect(recolorKey('kit_hoops', '#ffd23f', '#10122a')).not.toBe(recolorKey('kit_stripes', '#ffd23f', '#10122a'))
  })
})

describe('createFixedStep', () => {
  it('runs logic once per elapsed step and reports progress into the next', () => {
    const step = createFixedStep(10)
    const calls: number[] = []
    const alpha = step.advance(25, ms => calls.push(ms))
    expect(calls).toEqual([10, 10])
    expect(alpha).toBeCloseTo(0.5)
  })

  it('plays the same number of steps whether time arrives in one frame or many (when the cap allows it)', () => {
    const slow = createFixedStep(16, 20)
    const fast = createFixedStep(16)
    let slowSteps = 0
    let fastSteps = 0
    slow.advance(160, () => slowSteps++)
    for (let i = 0; i < 10; i++)
      fast.advance(16, () => fastSteps++)
    expect(slowSteps).toBe(fastSteps)
  })

  it('drops the backlog after a long pause instead of fast-forwarding', () => {
    const step = createFixedStep(10, 5)
    let steps = 0
    step.advance(60_000, () => steps++)
    expect(steps).toBe(5)
    steps = 0
    step.advance(10, () => steps++)
    expect(steps).toBe(1)
  })

  it('ignores a negative delta (a clock that went backwards) and rejects a bad step', () => {
    const step = createFixedStep(10)
    let steps = 0
    step.advance(-500, () => steps++)
    expect(steps).toBe(0)
    expect(() => createFixedStep(0)).toThrow('positive')
  })
})

describe('scaling', () => {
  it('picks the largest whole-number scale that fits, never below 1', () => {
    expect(integerScale(390, 844, 176, 130)).toBe(2)
    expect(integerScale(390, 844, 130, 130)).toBe(3)
    expect(integerScale(100, 100, 176, 130)).toBe(1)
  })

  it('sizes the canvas backing store for sharp pixels on high-density screens', () => {
    expect(canvasBackingSize(176, 130, 2, 3)).toEqual({ width: 1056, height: 780, cssWidth: 352, cssHeight: 260 })
    expect(canvasBackingSize(176, 130, 2, 2.625)).toMatchObject({ width: 1056 })
    expect(canvasBackingSize(176, 130, 2, 0.5)).toMatchObject({ width: 352 })
  })

  it('builds a pixelated 9-slice style at the chosen zoom', () => {
    const style = nineSliceStyle('/button.png', 4, 3)
    expect(style.borderWidth).toBe('12px')
    expect(style.borderImage).toBe('url(/button.png) 4 fill / 12px stretch')
    expect(style.imageRendering).toBe('pixelated')
  })
})
