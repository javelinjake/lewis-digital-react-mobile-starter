import { Link, useParams } from 'react-router'
import { ContentBody, MediaImage } from '@/components/rich-text'
import { StatusBadge } from '@/components/status-badge'
import { PrimaryButton } from '@/components/ui'
import { getActiveLog } from '@/lib/activity-log'
import { useActivityStatusQuery } from '@/lib/use-activity'
import { useWorkoutQuery } from '@/lib/use-content'

export function WorkoutDetailScreen() {
  const { id = '' } = useParams()
  const query = useWorkoutQuery(id)
  const workout = query.data
  const statusQuery = useActivityStatusQuery('workout', workout?.id)
  const activeLog = workout ? getActiveLog('workout', workout.id) : null
  const status = activeLog ? 'started' : (statusQuery.data ?? null)

  if (query.isPending)
    return <main className="screen"><p>Loading workout…</p></main>
  if (!workout)
    return <main className="screen"><p>That workout could not be found.</p></main>

  return (
    <main className="screen screen-stack">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-4xl font-bold">{workout.name}</h1>
        <StatusBadge status={status} itemType="workout" />
      </div>
      <ContentBody value={workout.description} className="mb-4 text-lg" />
      <MediaImage file={workout.image} alt="" className="mb-4 aspect-video w-full rounded-3xl bg-brand-card object-cover" />
      {workout.time
        ? <p className="mb-4 text-sm font-bold opacity-80">{workout.time}</p>
        : null}
      {workout.tagGroups.length
        ? (
            <dl className="mb-4 space-y-2 rounded-3xl bg-brand-card p-4 text-sm">
              {workout.tagGroups.map(group => (
                <div key={group.type} className="grid grid-cols-[6.5rem_1fr] gap-3">
                  <dt className="font-bold capitalize text-brand-navy/70">{group.label}</dt>
                  <dd className="font-bold">{group.tags.map(tag => tag.name).join(', ')}</dd>
                </div>
              ))}
            </dl>
          )
        : null}
      <section className="mb-4">
        <h2 className="mb-2 text-xl font-bold">Warm up</h2>
        <div className="rounded-3xl bg-brand-card p-4">
          <ContentBody value={workout.warmUp || 'No warm up provided yet.'} />
        </div>
      </section>
      <section className="mb-4">
        <h2 className="mb-2 text-xl font-bold">Workout</h2>
        <div className="rounded-3xl bg-brand-card p-4">
          <ContentBody value={workout.mainWorkout || 'No workout provided yet.'} />
        </div>
      </section>
      <ContentBody value={workout.notes} className="mb-4 rounded-3xl bg-brand-card p-4 text-sm" />
      <Link to={`/workouts/${workout.id}/session`}>
        <PrimaryButton>Start warm-up</PrimaryButton>
      </Link>
    </main>
  )
}
