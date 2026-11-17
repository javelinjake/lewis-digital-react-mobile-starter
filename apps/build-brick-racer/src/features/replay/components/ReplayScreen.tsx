import type { ReplayCameraMode } from '@/game/camera/replay-cam'
import type { ReplayData } from '../use-replay-data'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Icon } from '@/components/ui/Icon'
import { ScreenHeader, Stripes } from '@/components/ui/ScreenHeader'
import { usePrefsStore } from '@/stores/prefs.store'
import { ReplayEngine } from '../replay-engine'
import { eventTicks, formatClock, formatPercent, SCRUB_STEPS, sliderToTime, timeToSlider } from '../scrubber-math'
import { useReplayData } from '../use-replay-data'
import '../replay.css'

const CAMERAS: Array<{ id: ReplayCameraMode, label: string }> = [
  { id: 'auto', label: 'Auto' },
  { id: 'chase', label: 'Chase' },
  { id: 'side', label: 'Side' },
  { id: 'low', label: 'Low' },
  { id: 'top', label: 'Top' },
]

/** Route `/replay/:runId`. */
export function ReplayScreen() {
  const { runId } = useParams()
  const navigate = useNavigate()
  const state = useReplayData(runId)
  const toResults = () => navigate(runId ? `/results/${runId}` : '/')

  if (state.status === 'loading') {
    return (
      <div className="br-screen" data-testid="replay-loading">
        <ScreenHeader title="Replay" />
        <div className="br-layer rp-center"><span className="loading loading-spinner loading-lg text-primary" /></div>
      </div>
    )
  }
  if (state.status === 'norun' || state.status === 'unavailable') {
    const unavailable = state.status === 'unavailable'
    return (
      <div className="br-screen" data-testid="replay-unavailable">
        <ScreenHeader
          title={unavailable ? 'Replay unavailable' : 'Run not found'}
          left={<button type="button" className="btn br-btn br-btn-icon" aria-label="Back" onClick={toResults}><Icon name="back" /></button>}
        />
        <div className="br-layer rp-center">
          <div className="br-panel rp-card">
            <p className="text-lg">{unavailable ? state.reason : 'That run is not on this device any more.'}</p>
            <div className="rp-card-actions">
              <button type="button" className="btn br-btn br-cta" onClick={unavailable ? toResults : () => navigate('/')}>
                {unavailable ? 'Back to results' : 'Garage'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }
  return <ReplayStage data={state.data} runId={state.data.run.id} onBack={toResults} />
}

function ReplayStage({ data, runId, onBack }: { data: ReplayData, runId: string, onBack: () => void }) {
  const reducedMotion = usePrefsStore(s => s.prefs.reducedMotion)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<ReplayEngine | null>(null)
  const timeRef = useRef<HTMLSpanElement>(null)
  const percentRef = useRef<HTMLSpanElement>(null)
  const rangeRef = useRef<HTMLInputElement>(null)
  const scrubbing = useRef(false)
  const [playing, setPlaying] = useState(true)
  const [mode, setMode] = useState<ReplayCameraMode>('auto')
  const [speed, setSpeed] = useState(1)
  const [error, setError] = useState(false)
  const duration = data.record.duration
  const ticks = useMemo(() => eventTicks(data.record.events, duration), [data.record.events, duration])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas)
      return
    try {
      const engine = new ReplayEngine({
        canvas,
        doc: data.doc,
        spec: data.spec,
        env: data.env,
        challenge: data.challenge,
        record: data.record,
        reducedMotion,
        onTick: (t) => {
          if (timeRef.current)
            timeRef.current.textContent = formatClock(t)
          if (percentRef.current)
            percentRef.current.textContent = formatPercent(t, duration)
          if (rangeRef.current && !scrubbing.current)
            rangeRef.current.value = String(timeToSlider(t, duration))
        },
        onPlayState: setPlaying,
      })
      engineRef.current = engine
    }
    catch {
      setError(true)
    }
    return () => {
      engineRef.current?.dispose()
      engineRef.current = null
    }
  }, [data, duration, reducedMotion])

  if (error) {
    return (
      <div className="br-screen">
        <ScreenHeader title="3D not available" />
        <div className="br-layer rp-center">
          <div className="br-panel rp-card">
            <p className="text-lg">This device can’t show the replay right now. Your result is still saved.</p>
            <div className="rp-card-actions"><button type="button" className="btn br-btn br-cta" onClick={onBack}>Back to results</button></div>
          </div>
        </div>
      </div>
    )
  }

  const title = data.challenge?.shortName ?? data.run.challengeId
  return (
    <div className="rp-root" data-testid="replay-root" data-run={runId}>
      <canvas ref={canvasRef} className="rp-canvas" aria-label="Replay view" />
      <div className="rp-hud">
        <header className="rp-top">
          <button type="button" className="btn br-btn br-cta br-btn-icon rp-back" aria-label="Back to results" onClick={onBack}>
            <Icon name="back" />
          </button>
          <div className="rp-title">
            <span className="br-display rp-title-text">Replay</span>
            <Stripes />
            <span className="br-chip rp-chip">{title}</span>
          </div>
          <button type="button" className="btn br-btn br-cta rp-to-results" onClick={onBack} data-testid="back-to-results">
            Back to results <Icon name="chevrons" />
          </button>
        </header>

        <div className="br-panel rp-cams" role="group" aria-label="Camera">
          {CAMERAS.map(c => (
            <button
              key={c.id}
              type="button"
              className={`rp-cam ${mode === c.id ? 'is-active' : ''}`}
              aria-pressed={mode === c.id}
              data-testid={`cam-${c.id}`}
              onClick={() => {
                setMode(c.id)
                engineRef.current?.setMode(c.id)
              }}
            >
              <Icon name="camera" size={20} />
              <span>{c.label}</span>
            </button>
          ))}
        </div>

        <div className="br-panel rp-bar">
          <button
            type="button"
            className="btn br-btn br-cta br-btn-icon"
            aria-label={playing ? 'Pause' : 'Play'}
            data-testid="play-pause"
            onClick={() => (playing ? engineRef.current?.pause() : engineRef.current?.play())}
          >
            <Icon name={playing ? 'pause' : 'play'} />
          </button>
          <button type="button" className="btn br-btn br-btn-icon" aria-label="Restart" data-testid="restart" onClick={() => engineRef.current?.restart()}>
            <Icon name="restart" />
          </button>
          <div className="rp-clock">
            <span className="rp-time"><span ref={timeRef} data-testid="replay-time">00:00.0</span> / {formatClock(duration)}</span>
            <div className="rp-track">
              <div className="rp-ticks" aria-hidden="true">
                {ticks.map((t, i) => <i key={`${t.type}-${i}`} className={`is-${t.type}`} style={{ left: `${t.left}%` }} title={t.label} />)}
              </div>
              <input
                ref={rangeRef}
                type="range"
                className="range br-range rp-range"
                min={0}
                max={SCRUB_STEPS}
                step={1}
                defaultValue={0}
                aria-label="Replay position"
                data-testid="scrubber"
                onPointerDown={() => {
                  scrubbing.current = true
                }}
                onPointerUp={() => {
                  scrubbing.current = false
                }}
                onPointerCancel={() => {
                  scrubbing.current = false
                }}
                onInput={(e) => {
                  scrubbing.current = true
                  engineRef.current?.seek(sliderToTime(Number(e.currentTarget.value), duration))
                }}
                onChange={() => {
                  scrubbing.current = false
                }}
              />
            </div>
          </div>
          <span className="rp-percent" ref={percentRef}>0%</span>
          <div className="rp-speeds" role="group" aria-label="Speed">
            {[0.5, 1].map(s => (
              <button
                key={s}
                type="button"
                className={`rp-speed ${speed === s ? 'is-active' : ''}`}
                aria-pressed={speed === s}
                data-testid={`speed-${s}`}
                onClick={() => {
                  setSpeed(s)
                  engineRef.current?.setSpeed(s)
                }}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
