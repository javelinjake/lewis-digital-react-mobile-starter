import { describe, expect, it, vi } from 'vitest'
import { createAudioManager } from '../src'

function fakeContext() {
  const sources: Array<{ buffer: unknown, loop: boolean, started: number, stopped: number }> = []
  const gains: Array<{ gain: { value: number } }> = []
  const context = {
    state: 'suspended',
    destination: {},
    resume: vi.fn(async () => { context.state = 'running' }),
    createGain: () => {
      const node = { gain: { value: 1 }, connect: (target: unknown) => target }
      gains.push(node)
      return node
    },
    createBufferSource: () => {
      const node = { buffer: null as unknown, loop: false, started: 0, stopped: 0, connect: (target: unknown) => target, start() { node.started++ }, stop() { node.stopped++ } }
      sources.push(node)
      return node
    },
  }
  return { context: context as unknown as AudioContext, sources, gains, resume: context.resume }
}

const sources = { sfx: { tap: '/tap.m4a', goal: '/goal.m4a' }, music: { menu: '/menu.m4a', match: '/match.m4a' } }

function setup() {
  const fake = fakeContext()
  const loadBuffer = vi.fn(async (_context: AudioContext, url: string) => ({ url }) as unknown as AudioBuffer)
  const manager = createAudioManager(sources, { context: fake.context, loadBuffer })
  // The first two gains are the sfx and music channels.
  return { ...fake, loadBuffer, manager, sfxChannel: fake.gains[0], musicChannel: fake.gains[1] }
}

describe('audio manager', () => {
  it('resumes the context on the first tap, and only once while it is running', async () => {
    const { manager, resume } = setup()
    await manager.unlock()
    await manager.unlock()
    expect(resume).toHaveBeenCalledTimes(1)
  })

  it('plays an effect, and decodes each file only once however often it plays', async () => {
    const { manager, sources: nodes, loadBuffer } = setup()
    await manager.playSfx('tap')
    await manager.playSfx('tap')
    expect(nodes.filter(node => node.started === 1)).toHaveLength(2)
    expect(loadBuffer).toHaveBeenCalledTimes(1)
  })

  it('plays nothing while sound effects are off, and silences the channel', async () => {
    const { manager, sources: nodes, sfxChannel } = setup()
    manager.setSfxEnabled(false)
    await manager.playSfx('goal')
    expect(nodes).toHaveLength(0)
    expect(sfxChannel.gain.value).toBe(0)
    manager.setSfxEnabled(true)
    expect(sfxChannel.gain.value).toBeGreaterThan(0)
  })

  it('keeps music and effects on separate switches', () => {
    const { manager, sfxChannel, musicChannel } = setup()
    manager.setMusicEnabled(false)
    expect(musicChannel.gain.value).toBe(0)
    expect(sfxChannel.gain.value).toBeGreaterThan(0)
  })

  it('silences music in the background and brings it back, without restarting the track', async () => {
    const { manager, sources: nodes, musicChannel } = setup()
    await manager.playMusic('menu')
    manager.setHidden(true)
    expect(musicChannel.gain.value).toBe(0)
    manager.setHidden(false)
    expect(musicChannel.gain.value).toBeGreaterThan(0)
    expect(nodes[0].started).toBe(1)
  })

  it('does not stay silent when music is switched off and the app returns', () => {
    const { manager, musicChannel } = setup()
    manager.setMusicEnabled(false)
    manager.setHidden(true)
    manager.setHidden(false)
    expect(musicChannel.gain.value).toBe(0)
  })

  it('loops music, ignores a repeat of the same track, and stops the old one when the track changes', async () => {
    const { manager, sources: nodes } = setup()
    await manager.playMusic('menu')
    await manager.playMusic('menu')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].loop).toBe(true)

    await manager.playMusic('match')
    expect(nodes[0].stopped).toBe(1)
    expect(manager.state.music).toBe('match')

    manager.stopMusic()
    expect(manager.state.music).toBeNull()
  })

  it('rejects a sound it was never given', async () => {
    const { manager } = setup()
    await expect(manager.playSfx('missing')).rejects.toThrow('No sfx sound named "missing"')
  })
})
