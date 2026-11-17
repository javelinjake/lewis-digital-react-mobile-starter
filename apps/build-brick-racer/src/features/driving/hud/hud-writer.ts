import type { ChallengeRun } from '@/game/challenges/run'
import type { VehicleState } from '@/game/vehicle/sim'
import type { HudView } from './hud-view'
import { cueFor, formatSpeed, formatTime } from './format'

export interface HudFrame {
  view: HudView
  state: VehicleState
  run: ChallengeRun | null
  /** Seconds since Go (or since the session began in free drive). */
  elapsed: number
  /** A transient message such as "Checkpoint 2 / 4". */
  toast: string | null
  throttleOn: boolean
}

/** Written ~15 times a second straight to the DOM. No React state is touched here. */
export function writeHud(f: HudFrame): void {
  const { view, state, run } = f
  view.set('speed', formatSpeed(state.speed))
  const def = run?.def ?? null
  const rs = run?.run ?? null

  view.set('time', def ? formatTime(rs?.t ?? 0) : 'FREE')
  view.style('progress', '--p', `${Math.round((rs?.progress ?? 0) * 100)}%`)
  view.show('progressBar', Boolean(def && def.gates.length > 0))

  const cue = cueFor(def, rs, state)
  view.show('cue', cue.kind !== 'none')
  view.set('cueTitle', cue.title)
  view.set('cueDetail', cue.detail)
  view.toggle('cue', 'is-active', Boolean(cue.active))
  view.show('band', cue.kind === 'band')
  if (cue.band) {
    view.style('bandZone', 'left', `${(cue.band.lo * 100).toFixed(1)}%`)
    view.style('bandZone', 'width', `${((cue.band.hi - cue.band.lo) * 100).toFixed(1)}%`)
    view.style('bandMarker', 'left', `${(cue.band.marker * 100).toFixed(1)}%`)
    view.toggle('band', 'is-ok', cue.band.inside)
  }

  const motorOff = def ? (def.powerMode === 'gravity' || (rs ? !rs.motorEnabled : false)) : false
  view.show('motor', motorOff)
  view.set('motor', def?.powerMode === 'gravity' ? 'Downhill — motor off' : 'Motor off — coast')
  view.attr('throttle', 'data-motor', motorOff ? 'off' : 'on')
  view.show('reverse', state.reversing)
  view.show('practice', Boolean(rs && (rs.resets > 0 || rs.invalid.size > 0)))
  view.set('practice', rs && rs.resets > 0 ? 'Practice run · reset used' : 'Practice run')
  view.show('airborne', state.airborne)

  const message = f.toast ?? rs?.message ?? ''
  view.set('message', message)
  view.show('message', message.length > 0)
}
