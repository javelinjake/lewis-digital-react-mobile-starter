import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { OutlineButton, PrimaryButton } from '@/components/ui'
import { finishItemActivity, getActiveLog, saveActivityNote } from '@/lib/activity-log'
import { activityKeys } from '@/lib/use-activity'
import { useWorkoutQuery } from '@/lib/use-content'
import { useFamilyState } from '@/lib/use-family-state'
import { refreshBalance } from '@/lib/zactivs'

const feelings = ['Felt great', 'Pretty good', 'We had fun']

export function WorkoutCompleteScreen() {
  const { id = '' } = useParams()
  const location = useLocation()
  const queryClient = useQueryClient()
  const state = location.state as { elapsed?: number, rounds?: number } | null
  const query = useWorkoutQuery(id)
  const { update } = useFamilyState()
  const [feeling, setFeeling] = useState('')
  const [note, setNote] = useState('')
  const [credited, setCredited] = useState(false)
  const saved = useRef(false)
  const logIdRef = useRef<number | null>(null)
  const workout = query.data
  const elapsed = state?.elapsed ?? 0
  const rounds = state?.rounds ?? 1

  useEffect(() => {
    if (!workout || saved.current)
      return
    saved.current = true

    const active = getActiveLog('workout', workout.id)
    logIdRef.current = active?.logId ?? null

    void (async () => {
      const duration = elapsed > 0
        ? elapsed
        : active
          ? Math.floor((Date.now() - new Date(active.startTime).getTime()) / 1000)
          : 0

      const ok = await finishItemActivity('workout', workout.id, duration)
      if (ok) {
        setCredited(true)
        if (workout.zactivs)
          await refreshBalance(workout.zactivs)
        else
          await refreshBalance()
      }

      await queryClient.invalidateQueries({ queryKey: activityKeys.item('workout', workout.id) })
      await queryClient.invalidateQueries({ queryKey: ['activity-status', 'workout'] })
    })()
  }, [elapsed, queryClient, workout])

  function rememberNote(value = note) {
    const logId = logIdRef.current
    if (logId)
      void saveActivityNote(logId, value).catch(() => {})
  }

  if (!workout)
    return <main className="screen"><p>Loading…</p></main>

  return (
    <main className="screen screen-stack text-center">
      <div className="mx-auto mb-4 grid size-20 place-items-center rounded-full bg-brand-yellow text-4xl font-bold">✓</div>
      <h1 className="text-4xl font-bold">Nice work!</h1>
      <p className="mb-4 text-lg">
        {workout.name}
        {' completed.'}
      </p>
      <p className="mb-2 font-bold">
        {rounds}
        {' rounds · '}
        {Math.floor(elapsed / 60)}
        :
        {String(elapsed % 60).padStart(2, '0')}
      </p>
      {credited && workout.zactivs
        ? (
            <p className="mb-6 font-bold text-brand-blue">
              +
              {workout.zactivs}
              {' Z earned'}
            </p>
          )
        : null}
      <fieldset className="mb-4 text-left">
        <legend className="mb-2 font-bold">How did that feel?</legend>
        <div className="flex flex-wrap gap-2">
          {feelings.map(item => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setFeeling(item)
                update(current => ({ ...current, feelings: { ...current.feelings, [String(workout.id)]: item } }))
              }}
              className={`rounded-full px-4 py-2 font-bold ${feeling === item ? 'bg-brand-blue text-white' : 'bg-brand-card'}`}
            >
              {item}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="mb-4 block text-left">
        <span className="mb-1 block font-bold">Anything you want to remember?</span>
        <textarea
          value={note}
          onChange={event => setNote(event.target.value)}
          onBlur={event => rememberNote(event.target.value)}
          className="min-h-24 w-full rounded-2xl border border-brand-line bg-brand-card p-3"
          placeholder="Add a note..."
        />
      </label>
      <Link to="/"><PrimaryButton>Back to home</PrimaryButton></Link>
      <Link to="/workouts" className="mt-3 block"><OutlineButton>More workouts</OutlineButton></Link>
    </main>
  )
}
