import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { MediaImage } from '@/components/rich-text'
import { StatusBadge } from '@/components/status-badge'
import { ChipRow, MediaFallback, SearchField } from '@/components/ui'
import { getActiveLog } from '@/lib/activity-log'
import { useActivityStatusMapQuery } from '@/lib/use-activity'
import { useRecipesQuery } from '@/lib/use-content'

export function RecipesScreen() {
  const query = useRecipesQuery()
  const [search, setSearch] = useState('')
  const [chip, setChip] = useState('All')
  const items = useMemo(() => query.data ?? [], [query.data])
  const statusMapQuery = useActivityStatusMapQuery('recipe', items.map(item => item.id))
  const chips = useMemo(() => ['All', ...new Set(items.flatMap(item => item.tags))].slice(0, 6), [items])
  const visible = items.filter(item => item.name.toLowerCase().includes(search.trim().toLowerCase()) && (chip === 'All' || item.tags.includes(chip)))

  function statusFor(id: number) {
    if (getActiveLog('recipe', id))
      return 'started' as const
    return statusMapQuery.data?.[id] ?? null
  }

  return (
    <main className="screen">
      <h1 className="mb-4 text-4xl font-bold">Good food, together</h1>
      <SearchField value={search} onChange={setSearch} placeholder="Search recipes" />
      <div className="my-4"><ChipRow options={chips} value={chip} onChange={setChip} /></div>
      {query.isPending ? <p>Loading recipes…</p> : null}
      {query.isError ? <p>Recipes are unavailable right now.</p> : null}
      <ul className="flex flex-col gap-3">
        {visible.map(item => (
          <li key={item.id}>
            <Link to={`/recipes/${item.id}`} className="block overflow-hidden rounded-3xl bg-brand-card">
              {item.image
                ? <MediaImage file={item.image} alt="" className="aspect-video w-full object-cover" />
                : <MediaFallback icon="fork-knife" label="Recipe" />}
              <span className="block p-4">
                <span className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-xl font-bold">{item.name}</span>
                  <StatusBadge status={statusFor(item.id)} itemType="recipe" size="small" />
                </span>
                <span className="block text-sm opacity-70">{item.minutes ? `${item.minutes} min` : item.tags[0] || item.description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
