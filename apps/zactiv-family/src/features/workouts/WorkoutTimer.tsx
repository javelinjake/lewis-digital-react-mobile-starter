import { useEffect, useMemo, useRef, useState } from 'react'
import { OutlineButton, PrimaryButton } from '@/components/ui'

export type WorkoutTimerType = 'countdown' | 'countup' | 'emom' | 'tabata'

interface WorkoutTimerProps {
  timerType: WorkoutTimerType
  countDownTimeCap?: number | null
  emomRoundDuration?: number | null
  emomRounds?: number | null
  tabataRounds?: number | null
  tabataWork?: number | null
  tabataRest?: number | null
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function WorkoutTimer(props: WorkoutTimerProps) {
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [round, setRound] = useState(1)
  const [tabataPhase, setTabataPhase] = useState<'work' | 'rest'>('work')
  const lastStartRound = useRef(0)

  const emomRoundDuration = props.emomRoundDuration || 60
  const tabataWork = props.tabataWork || 20
  const tabataRest = props.tabataRest || 40
  const countDownCap = props.countDownTimeCap || 0

  const remaining = useMemo(() => {
    if (props.timerType === 'countdown')
      return Math.max(0, countDownCap - elapsed)

    if (props.timerType === 'countup')
      return elapsed

    if (props.timerType === 'emom') {
      const intoRound = elapsed % emomRoundDuration
      return emomRoundDuration - intoRound
    }

    const cycleTime = tabataWork + tabataRest
    const cycleElapsed = elapsed % cycleTime
    if (tabataPhase === 'work')
      return Math.max(0, tabataWork - cycleElapsed)

    return Math.max(0, tabataRest - (cycleElapsed - tabataWork))
  }, [countDownCap, elapsed, emomRoundDuration, props.timerType, tabataPhase, tabataRest, tabataWork])

  useEffect(() => {
    if (!running)
      return

    const handle = window.setInterval(() => {
      setElapsed((value) => {
        const next = value + 1

        if (props.timerType === 'countdown' && next >= countDownCap) {
          setRunning(false)
          return countDownCap
        }

        if (props.timerType === 'emom') {
          const totalRounds = props.emomRounds || 0
          const maxDuration = totalRounds > 0 ? emomRoundDuration * totalRounds : 0
          if (maxDuration > 0 && next >= maxDuration) {
            setRunning(false)
            return maxDuration
          }
          const roundNumber = Math.floor(next / emomRoundDuration) + 1
          setRound(roundNumber)
          const intoRound = next % emomRoundDuration
          if (intoRound === 0 && next > 0 && roundNumber !== lastStartRound.current)
            lastStartRound.current = roundNumber
        }

        if (props.timerType === 'tabata') {
          const cycleTime = tabataWork + tabataRest
          const cycleElapsed = next % cycleTime
          if (cycleElapsed === 0 && next > 0) {
            setTabataPhase('work')
            setRound(current => current + 1)
            const maxRounds = props.tabataRounds || 0
            if (maxRounds > 0 && round + 1 > maxRounds) {
              setRunning(false)
            }
          }
          else if (cycleElapsed === tabataWork) {
            setTabataPhase('rest')
          }
          else if (cycleElapsed < tabataWork) {
            setTabataPhase('work')
          }
        }

        return next
      })
    }, 1000)

    return () => window.clearInterval(handle)
  }, [countDownCap, emomRoundDuration, props.emomRounds, props.timerType, props.tabataRounds, round, running, tabataRest, tabataWork])

  function reset() {
    setRunning(false)
    setElapsed(0)
    setRound(1)
    setTabataPhase('work')
    lastStartRound.current = 0
  }

  const mainDisplay = props.timerType === 'countdown'
    ? formatTime(remaining)
    : props.timerType === 'countup'
      ? formatTime(elapsed)
      : props.timerType === 'emom'
        ? String(Math.floor(remaining))
        : String(Math.floor(remaining))

  return (
    <section className="mb-4 rounded-3xl bg-brand-card p-4 text-center">
      {props.timerType === 'emom'
        ? (
            <>
              <p className="text-sm opacity-70">
                Total:
                {' '}
                {formatTime(elapsed)}
              </p>
              <p className="my-2 text-4xl font-bold tabular-nums">{mainDisplay}</p>
              <p className="mb-3 text-lg font-bold text-brand-yellow">
                Round
                {' '}
                {round}
                {' / '}
                {props.emomRounds || '∞'}
              </p>
            </>
          )
        : null}
      {props.timerType === 'tabata'
        ? (
            <>
              <p className="text-sm opacity-70">
                Total:
                {' '}
                {formatTime(elapsed)}
              </p>
              <p className={`text-lg font-bold ${tabataPhase === 'work' ? 'text-green-700' : 'text-brand-blue'}`}>
                {tabataPhase === 'work' ? 'Work' : 'Rest'}
              </p>
              <p className="my-2 text-4xl font-bold tabular-nums">{mainDisplay}</p>
              <p className="mb-3 text-lg font-bold text-brand-yellow">
                Round
                {' '}
                {round}
                {' / '}
                {props.tabataRounds || '?'}
              </p>
            </>
          )
        : null}
      {props.timerType === 'countdown' || props.timerType === 'countup'
        ? <p className="mb-3 text-4xl font-bold tabular-nums">{mainDisplay}</p>
        : null}
      <div className="flex flex-wrap justify-center gap-2">
        <PrimaryButton className="!w-auto px-5" onClick={() => setRunning(value => !value)}>
          {running ? 'Pause timer' : (elapsed > 0 ? 'Resume timer' : 'Start timer')}
        </PrimaryButton>
        {elapsed > 0
          ? <OutlineButton className="!w-auto px-5" onClick={reset}>Reset timer</OutlineButton>
          : null}
      </div>
    </section>
  )
}
