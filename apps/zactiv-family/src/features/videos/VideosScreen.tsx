import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { MediaImage } from '@/components/rich-text'
import { ChipRow, Icon, SearchField } from '@/components/ui'
import { useVideosQuery } from '@/lib/use-content'

function VideoThumbnail({ image, name }: { image?: string, name: string }) {
  if (image)
    return <MediaImage file={image} alt="" className="aspect-video w-full object-cover" />

  return (
    <div className="grid aspect-video place-items-center bg-brand-blue text-4xl text-white" aria-hidden>
      <Icon name="play" />
      <span className="sr-only">{name}</span>
    </div>
  )
}

export function VideosScreen() {
  const query = useVideosQuery()
  const [search, setSearch] = useState('')
  const [chip, setChip] = useState('All')
  const items = useMemo(() => query.data ?? [], [query.data])
  const chips = useMemo(() => ['All', ...new Set(items.flatMap(item => item.tags))].slice(0, 6), [items])
  const visible = items.filter(item => item.name.toLowerCase().includes(search.trim().toLowerCase()) && (chip === 'All' || item.tags.includes(chip)))

  return (
    <main className="screen">
      <h1 className="mb-4 text-4xl font-bold">Watch something good</h1>
      <SearchField value={search} onChange={setSearch} placeholder="Search videos" />
      <div className="my-4"><ChipRow options={chips} value={chip} onChange={setChip} /></div>
      {query.isPending ? <p>Loading videos…</p> : null}
      <ul className="flex flex-col gap-3">
        {visible.map(item => (
          <li key={item.id}>
            <Link to={`/videos/${item.id}`} className="block overflow-hidden rounded-3xl bg-brand-card">
              <VideoThumbnail image={item.image} name={item.name} />
              <span className="block p-4">
                <span className="block text-xl font-bold">{item.name}</span>
                <span className="block text-sm opacity-70">{item.tags[0] || item.description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
