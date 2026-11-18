import { createMemoryStorage } from '@ld/offline'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SettingsScreen } from '@/features/settings/components/SettingsScreen'
import { GameRepo } from '@/game/persistence/repo'
import { usePrefsStore } from '@/stores/prefs.store'
import { freshRepo } from './screens-helpers'

function renderSettings() {
  const router = createMemoryRouter([{ path: '/settings', Component: SettingsScreen }, { path: '/', Component: () => <p>garage</p> }], { initialEntries: ['/settings'] })
  return render(<RouterProvider router={router} />)
}

describe('settings (AC29)', () => {
  beforeEach(() => {
    freshRepo()
  })
  afterEach(cleanup)

  it('saves left-handed, control size, reduced motion, mute and build mode, and restores them after a restart', async () => {
    const { kv } = freshRepo()
    renderSettings()
    fireEvent.click(screen.getByLabelText('Left-handed'))
    fireEvent.change(screen.getByLabelText('Control size'), { target: { value: '1.3' } })
    fireEvent.click(screen.getByLabelText('Reduced motion'))
    fireEvent.click(screen.getByLabelText('Mute all sound'))
    fireEvent.click(screen.getByRole('radio', { name: 'Free' }))

    const prefs = usePrefsStore.getState().prefs
    expect(prefs.controls).toEqual({ leftHanded: true, scale: 1.3 })
    expect(prefs.reducedMotion).toBe(true)
    expect(prefs.audio.muted).toBe(true)
    expect(prefs.buildMode).toBe('free')
    expect(document.documentElement.dataset.reducedMotion).toBe('true')

    const preview = screen.getByTestId('control-preview')
    expect(preview.getAttribute('data-lefty')).toBe('true')
    expect(preview.getAttribute('data-scale')).toBe('1.3')

    // A new session reads the same values back from storage.
    await waitFor(() => expect(kv.dump().get('prefs')).toContain('"leftHanded":true'))
    const restarted = new GameRepo(createMemoryStorage(), { get: async k => kv.dump().get(k) ?? null, set: async () => {} })
    const loaded = await restarted.loadPrefs()
    expect(loaded.controls).toEqual({ leftHanded: true, scale: 1.3 })
    expect(loaded.audio.muted).toBe(true)
    expect(loaded.buildMode).toBe('free')
  })

  it('steering help toggle and camera choice change the stored defaults independent of build mode', () => {
    renderSettings()
    fireEvent.click(screen.getByLabelText('Steering help'))
    fireEvent.change(screen.getByLabelText('Camera'), { target: { value: 'high' } })
    const p = usePrefsStore.getState().prefs
    expect(p.assist).toBe('off')
    expect(p.camera).toBe('high')
    expect(p.buildMode).toBe('easy')
  })

  it('done goes back to the garage when there is no history', () => {
    renderSettings()
    fireEvent.click(screen.getByRole('button', { name: /Done/i }))
    expect(screen.getByText('garage')).toBeTruthy()
  })
})
