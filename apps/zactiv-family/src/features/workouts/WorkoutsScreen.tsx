import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { MediaImage } from '@/components/rich-text'
import { StatusBadge } from '@/components/status-badge'
import { ChipRow, Panel, SearchField } from '@/components/ui'
import { getActiveLog } from '@/lib/activity-log'
import { useActivityStatusMapQuery } from '@/lib/use-activity'
import { useWorkoutsQuery } from '@/lib/use-content'

export function WorkoutsScreen() {
  const query = useWorkoutsQuery()
  const [search, setSearch] = useState('')
  const [chip, setChip] = useState('All')
  const items = useMemo(() => query.data ?? [], [query.data])
  const statusMapQuery = useActivityStatusMapQuery('workout', items.map(item => item.id))
  const chips = useMemo(() => ['All', 'Under 15 min', ...new Set(items.flatMap(item => item.tags))].slice(0, 6), [items])
  const visible = items.filter((item) => {
    const named = item.name.toLowerCase().includes(search.trim().toLowerCase())
    if (!named)
      return false
    if (chip === 'All')
      return true
    if (chip === 'Under 15 min')
      return (item.minutes ?? 99) < 15
    return item.tags.includes(chip)
  })
  const resume = visible.find(item => getActiveLog('workout', item.id))

  function statusFor(id: number) {
    if (getActiveLog('workout', id))
      return 'started' as const
    return statusMapQuery.data?.[id] ?? null
  }

  return (
    <main className="screen">
      <h1 className="mb-4 text-4xl font-bold">Find your next workout</h1>
      <SearchField value={search} onChange={setSearch} placeholder="Search workouts" />
      <div className="my-4">
        <ChipRow options={chips} value={chip} onChange={setChip} />
      </div>
      {resume
        ? (
            <Link to={`/workouts/${resume.id}/session`} className="mb-4 block rounded-3xl bg-brand-navy p-4 text-white">
              <p className="text-sm font-bold text-brand-yellow">Pick up where you left off</p>
              <h2 className="text-2xl font-bold">{resume.name}</h2>
              <p className="mt-2 font-bold text-brand-yellow">Continue workout</p>
            </Link>
          )
        : null}
      <h2 className="mb-3 text-lg font-bold">This week’s workouts</h2>
      {query.isPending ? <p>Loading workouts…</p> : null}
      {query.isError ? <p>Workouts are unavailable right now.</p> : null}
      <ul className="flex flex-col gap-3">
        {visible.map(item => (
          <li key={item.id}>
            <Panel className="flex items-center gap-3">
              <MediaImage file={item.image} alt="" className="size-16 shrink-0 rounded-2xl object-cover" />
              <Link to={`/workouts/${item.id}`} className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{item.name}</span>
                  <StatusBadge status={statusFor(item.id)} itemType="workout" size="small" />
                </span>
                <span className="text-sm opacity-70">{[item.time, item.tags[0]].filter(Boolean).join(' · ')}</span>
              </Link>
            </Panel>
          </li>
        ))}
      </ul>
    </main>
  )
}
