import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ContentBody } from '@/components/rich-text'
import { PrimaryButton } from '@/components/ui'
import { OptionalCountdown } from '@/features/workouts/OptionalCountdown'
import { WorkoutTimer } from '@/features/workouts/WorkoutTimer'
import { ensureActivityLog, getActiveLog, validateStoredLog } from '@/lib/activity-log'
import { defaultWarmupSeconds } from '@/lib/content-text'
import { useWorkoutQuery } from '@/lib/use-content'
import { useFamilyState } from '@/lib/use-family-state'
import { useAuthStore } from '@/stores/auth.store'

export function WorkoutSessionScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const userId = useAuthStore(state => state.user?.id)
  const query = useWorkoutQuery(id)
  const { state } = useFamilyState()
  const workout = query.data
  const [phase, setPhase] = useState<'warmup' | 'workout'>('warmup')

  useEffect(() => {
    if (!state.preferences.keepAwake || !('wakeLock' in navigator))
      return
    let lock: WakeLockSentinel | null = null
    void navigator.wakeLock.request('screen').then((sentinel) => {
      lock = sentinel
    }).catch(() => {})
    return () => {
      void lock?.release()
    }
  }, [state.preferences.keepAwake])

  useEffect(() => {
    if (!userId || !workout)
      return
    void (async () => {
      await validateStoredLog('workout', workout.id)
      await ensureActivityLog(userId, 'workout', workout.id)
    })().catch(() => {})
  }, [userId, workout])

  if (!workout)
    return <main className="screen"><p>Loading workout…</p></main>

  function completeWorkout() {
    if (!workout)
      return

    const active = getActiveLog('workout', workout.id)
    const elapsed = active
      ? Math.floor((Date.now() - new Date(active.startTime).getTime()) / 1000)
      : 0

    navigate(`/workouts/${workout.id}/complete`, { state: { elapsed, rounds: 1 } })
  }

  if (phase === 'warmup') {
    return (
      <main className="screen screen-stack">
        <h1 className="mb-2 text-4xl font-bold">Let&apos;s warm up</h1>
        <p className="mb-4 text-sm">Follow the warm-up below at your own pace.</p>
        <div className="mb-4 rounded-3xl bg-brand-card p-4">
          <ContentBody value={workout.warmUp || 'No warm up provided yet.'} />
        </div>
        <OptionalCountdown
          label="Use a timer for warm-up"
          defaultSeconds={defaultWarmupSeconds(workout.warmUp)}
        />
        <p className="mb-4 text-sm">Your screen stays awake during this session.</p>
        <PrimaryButton onClick={() => setPhase('workout')}>
          Finish warm-up
        </PrimaryButton>
      </main>
    )
  }

  return (
    <main className="screen screen-stack">
      <h1 className="mb-2 text-4xl font-bold">{workout.name}</h1>
      <p className="mb-4 text-sm">{workout.description}</p>
      {workout.timerType
        ? (
            <WorkoutTimer
              timerType={workout.timerType}
              countDownTimeCap={workout.countDownTimeCap}
              emomRoundDuration={workout.emomRoundDuration}
              emomRounds={workout.emomRounds}
              tabataRounds={workout.tabataRounds}
              tabataWork={workout.tabataWork}
              tabataRest={workout.tabataRest}
            />
          )
        : null}
      <h2 className="mb-2 text-xl font-bold">Workout</h2>
      <p className="mb-3 text-sm">Complete the workout below.</p>
      <div className="mb-4 rounded-3xl bg-brand-card p-4">
        <ContentBody value={workout.mainWorkout || 'No workout provided yet.'} />
      </div>
      <p className="mb-4 text-sm">Your screen stays awake during this session.</p>
      <PrimaryButton onClick={completeWorkout}>
        Complete workout
      </PrimaryButton>
    </main>
  )
}
