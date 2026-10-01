import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { PrimaryButton } from '@/components/ui'
import { formatLongDate } from '@/lib/content-text'
import { useFamilyState } from '@/lib/use-family-state'

export function PastChatsScreen() {
  const { state } = useFamilyState()
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const entries = useMemo(
    () => state.journal.filter(entry => entry.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date)),
    [month, state.journal],
  )
  const [selected, setSelected] = useState(entries[0]?.date ?? '')
  const current = entries.find(entry => entry.date === selected) ?? entries[0]

  return (
    <main className="screen screen-stack">
      <h1 className="mb-4 text-4xl font-bold">Past chats</h1>
      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-bold">Month</span>
        <input type="month" value={month} onChange={event => setMonth(event.target.value)} className="min-h-12 rounded-2xl border border-brand-line bg-brand-card px-4" />
      </label>
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {entries.map(entry => (
          <button key={entry.date} type="button" onClick={() => setSelected(entry.date)} className={`shrink-0 rounded-full px-4 py-2 font-bold ${current?.date === entry.date ? 'bg-brand-blue text-white' : 'bg-brand-card'}`}>
            {new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(`${entry.date}T12:00:00`))}
          </button>
        ))}
      </div>
      {current
        ? (
            <article className="mb-4 rounded-3xl bg-brand-card p-4">
              <h2 className="mb-2 text-2xl font-bold">{formatLongDate(`${current.date}T12:00:00`)}</h2>
              <p className="whitespace-pre-wrap">{current.body}</p>
              <p className="mt-3 text-sm font-bold">Shared family note</p>
            </article>
          )
        : <p className="mb-4">Days you skip stay empty. Nothing to catch up on.</p>}
      <Link to="/journal"><PrimaryButton>Back to today’s chat</PrimaryButton></Link>
    </main>
  )
}
