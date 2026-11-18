import type { DrivePhase } from '../engine/drive-engine'
import type { DrivePlan } from '../use-drive-plan'
import type { CameraChoice } from '@/game/persistence/types'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { appConfig } from '@/config/app.config'
import { recordRun } from '@/game/run-flow'
import { audio, haptics } from '@/lib/audio'
import { getRepo } from '@/lib/platform/repo'
import { WebGLUnavailableError } from '@/render'
import { useAppStore } from '@/stores/app.store'
import { usePrefsStore } from '@/stores/prefs.store'
import { useSessionStore } from '@/stores/session.store'
import { DriveEngine } from '../engine/drive-engine'
import { HudView } from '../hud/hud-view'
import { attachFocusGuard } from '../input/focus-guard'
import { ControlHub } from '../input/hub'
import { countRender, registerEngine } from '../test-hook'
import { Controls } from './Controls'
import { Hud } from './Hud'
import { CountdownOverlay, FinishBanner, ResetPrompt, TryHint } from './Overlays'
import { PauseOverlay } from './PauseOverlay'
import { BackButton, StatusPanel } from './StatusPanels'
import '../driving.css'

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

/** The live driving screen: canvas, HUD, touch controls and overlays around a `DriveEngine`. */
export function DriveStage({ plan }: { plan: DrivePlan }) {
  countRender()
  const navigate = useNavigate()
  const prefs = usePrefsStore(s => s.prefs)
  const trying = useSessionStore(s => s.trying)
  const hostRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<DriveEngine | null>(null)
  const startedAt = useRef('')
  const attemptOpen = useRef(false)
  const assistRef = useRef(prefs.assist)
  const [phase, setPhase] = useState<DrivePhase>('countdown')
  const [ready, setReady] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [resetPrompt, setResetPrompt] = useState(false)
  const [camera, setCamera] = useState<CameraChoice>(prefs.camera)
  const [locked, setLocked] = useState(prefs.cameraLock)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState<'webgl' | 'other' | null>(null)
  const [finish, setFinish] = useState<{ finished: boolean, message: string | null } | null>(null)
  const [saveError, setSaveError] = useState(false)

  const hubRef = useRef<ControlHub | null>(null)
  if (!hubRef.current) {
    hubRef.current = new ControlHub({
      reset: () => engineRef.current?.reset(),
      camera: () => engineRef.current?.cycleCamera(),
      lock: () => engineRef.current?.toggleLock(),
      pause: () => {
        const e = engineRef.current
        if (e?.phase === 'paused')
          e.resume()
        else
          e?.pause()
      },
    })
  }
  const hub = hubRef.current

  const record = useCallback(async () => {
    const engine = engineRef.current
    const def = plan.challenge
    const run = engine?.session.run
    if (!engine || !def || !run)
      return null
    const saved = await recordRun({
      repo: getRepo(),
      doc: plan.doc,
      def,
      session: engine.session,
      run,
      assist: assistRef.current,
      camera: engine.cameraMode,
      controls: usePrefsStore.getState().prefs.controls,
      startedAt: startedAt.current || new Date().toISOString(),
      replayBudgetBytes: appConfig.replayBudgetBytes,
    })
    useSessionStore.getState().setLastRun(saved.run.id)
    return saved.run
  }, [plan])

  const closeAttempt = useCallback(async () => {
    if (attemptOpen.current) {
      attemptOpen.current = false
      await getRepo().endAttempt()
    }
  }, [])

  const finishFlow = useCallback(async () => {
    const engine = engineRef.current
    const run = engine?.session.run
    if (!engine || !run)
      return
    const finished = run.run.phase === 'finished'
    setFinish({ finished, message: run.run.message })
    setSaveError(false)
    try {
      const [saved] = await Promise.all([record(), sleep(finished ? 1600 : 1300)])
      await closeAttempt()
      useSessionStore.getState().setTrying(false)
      if (saved)
        navigate(`/results/${saved.id}`, { replace: true })
    }
    catch {
      setSaveError(true)
    }
  }, [closeAttempt, navigate, record])
  const finishFlowRef = useRef(finishFlow)
  finishFlowRef.current = finishFlow

  /** Leave the screen. A challenge that is under way is abandoned and its partial progress is still saved. */
  const leave = useCallback(async (to: string) => {
    setBusy(true)
    const engine = engineRef.current
    try {
      if (plan.challenge && engine?.session.run?.run.phase === 'running') {
        engine.abandon()
        await record()
      }
    }
    catch {
      // The attempt could not be saved; leaving still works and the car is untouched.
    }
    await closeAttempt()
    navigate(to)
  }, [closeAttempt, navigate, plan.challenge, record])

  // Engine lifecycle.
  useEffect(() => {
    let cancelled = false
    const root = rootRef.current
    const host = hostRef.current
    if (!root || !host)
      return
    hub.attach()
    const detachGuard = attachFocusGuard(hub)
    useAppStore.getState().setDriving(true)
    assistRef.current = usePrefsStore.getState().prefs.assist
    const p = usePrefsStore.getState().prefs
    void DriveEngine.create({
      host,
      isCancelled: () => cancelled,
      hud: new HudView(root),
      hub,
      doc: plan.doc,
      spec: plan.spec,
      env: plan.env,
      challenge: plan.challenge,
      assist: assistRef.current,
      camera: p.camera,
      lock: p.cameraLock,
      reducedMotion: p.reducedMotion,
      callbacks: {
        onPhase: (next) => {
          setPhase(next)
          if (next === 'running' && plan.challenge && !attemptOpen.current && engineRef.current?.session.phase === 'running') {
            attemptOpen.current = true
            startedAt.current = new Date().toISOString()
            void getRepo().beginAttempt({ carId: plan.doc.carId, challengeId: plan.challenge.id })
          }
          if (next === 'finished')
            void finishFlowRef.current()
        },
        onCountdown: setCountdown,
        onResetPrompt: setResetPrompt,
        onCamera: (mode, lock) => {
          setCamera(mode)
          setLocked(lock)
        },
      },
    }).then((engine) => {
      if (!engine)
        return
      if (cancelled) {
        engine.dispose()
        return
      }
      engineRef.current = engine
      registerEngine(engine)
      setReady(true)
      engine.begin()
    }).catch((error: unknown) => {
      if (!cancelled)
        setLoadError(error instanceof WebGLUnavailableError ? 'webgl' : 'other')
    })
    return () => {
      cancelled = true
      registerEngine(null)
      engineRef.current?.dispose()
      engineRef.current = null
      detachGuard()
      hub.detach()
      useAppStore.getState().setDriving(false)
      void closeAttempt()
    }
  }, [plan, hub, closeAttempt])

  // Pausing: backgrounding, hidden page, lost focus and the Android back button.
  useEffect(() => {
    const pause = () => engineRef.current?.pause()
    const onHidden = () => {
      if (document.visibilityState === 'hidden') {
        pause()
        audio.suspend()
      }
    }
    const onBack = () => {
      const e = engineRef.current
      if (!e)
        return
      if (e.phase === 'paused')
        e.resume()
      else
        pause()
    }
    window.addEventListener('blur', pause)
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('br:back', onBack)
    const unsub = useAppStore.subscribe((s, prev) => {
      if (s.backgroundedTick !== prev.backgroundedTick)
        pause()
    })
    return () => {
      window.removeEventListener('blur', pause)
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('br:back', onBack)
      unsub()
    }
  }, [])

  // Audio and haptics follow preferences. Audio starts only after a user gesture.
  useEffect(() => {
    audio.apply(prefs.audio)
    haptics.setEnabled(prefs.vibration)
  }, [prefs.audio, prefs.vibration])
  useEffect(() => {
    const unlock = () => audio.unlock()
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  if (loadError) {
    return (
      <StatusPanel
        title={loadError === 'webgl' ? '3D not available' : 'Could not start'}
        actions={<BackButton onClick={() => navigate(-1)} />}
      >
        <p className="text-lg">
          {loadError === 'webgl' ? 'This device can’t show the 3D track right now. Try closing other apps, then come back.' : 'The track could not be loaded. Your car is safe in the garage.'}
        </p>
      </StatusPanel>
    )
  }

  const powered = plan.challenge ? plan.challenge.powerMode === 'motor' : true
  const placeLabel = plan.env.label
  return (
    <div className="dr-root" ref={rootRef} data-phase={phase} data-testid="drive-root">
      <div ref={hostRef} className="dr-canvas-host" />
      <div className="dr-hud-layer">
        <Hud
          challenge={plan.challenge}
          placeLabel={placeLabel}
          camera={camera}
          locked={locked}
          onPause={() => engineRef.current?.pause()}
          onReset={() => engineRef.current?.reset()}
          onCamera={() => engineRef.current?.cycleCamera()}
          onLock={() => engineRef.current?.toggleLock()}
        />
        <Controls hub={hub} leftHanded={prefs.controls.leftHanded} scale={prefs.controls.scale} powered={powered} enabled={phase === 'running'} />
        <CountdownOverlay n={phase === 'countdown' ? countdown : (countdown === 0 ? 0 : null)} />
        {resetPrompt && phase === 'running' && <ResetPrompt onReset={() => engineRef.current?.reset()} />}
        {trying && phase === 'countdown' && <TryHint />}
        {finish && (
          <FinishBanner finished={finish.finished} message={finish.message} />
        )}
        {saveError && (
          <div className="dr-reset-prompt">
            <button type="button" className="btn br-btn br-cta" onClick={() => void finishFlow()}>Try saving again</button>
          </div>
        )}
        {phase === 'paused' && (
          <PauseOverlay
            busy={busy}
            onResume={() => engineRef.current?.resume()}
            onRestart={() => {
              // A restart discards this attempt; the next Go opens a new one with a fresh start time.
              void closeAttempt()
              startedAt.current = ''
              setFinish(null)
              engineRef.current?.restart()
            }}
            onChangeCar={() => void leave('/play')}
            onGarage={() => void leave('/')}
            onAssist={(on) => {
              assistRef.current = on ? 'light' : 'off'
              engineRef.current?.setAssist(assistRef.current)
            }}
            onCamera={mode => engineRef.current?.setCamera(mode)}
          />
        )}
        {!ready && (
          <div className="dr-loading" role="status">
            <span className="loading loading-spinner loading-lg text-primary" aria-hidden="true" />
            <span className="br-display-sm">Getting your car ready…</span>
          </div>
        )}
      </div>
    </div>
  )
}
