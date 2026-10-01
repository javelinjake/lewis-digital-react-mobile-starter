import { useState } from 'react'
import { Link } from 'react-router'
import { PrimaryButton } from '@/components/ui'
import { formatLongDate, todayKey } from '@/lib/content-text'
import { journalPrompts } from '@/lib/family-data'
import { useFamilyState } from '@/lib/use-family-state'

export function JournalScreen() {
  const { state, update } = useFamilyState()
  const date = todayKey()
  const existing = state.journal.find(entry => entry.date === date)
  const [body, setBody] = useState(existing?.body ?? '')
  const [saved, setSaved] = useState(false)

  return (
    <main className="screen">
      <h1 className="text-4xl font-bold">Today’s after-school chat</h1>
      <p className="mb-4 font-bold">{formatLongDate(`${date}T12:00:00`)}</p>
      <p className="mb-4">One note for the whole family. Write as little or as much as you like.</p>
      <section className="mb-4 rounded-3xl bg-brand-card p-4">
        <h2 className="mb-2 font-bold">Need a starting point?</h2>
        <ul className="flex flex-col gap-2">
          {journalPrompts().map(prompt => (
            <li key={prompt}>
              <button type="button" className="w-full rounded-2xl bg-brand-cream px-3 py-2 text-left" onClick={() => setBody(current => current ? `${current}\n${prompt} ` : `${prompt} `)}>
                {prompt}
              </button>
            </li>
          ))}
        </ul>
      </section>
      <label className="mb-2 block font-bold" htmlFor="journal-note">Today’s note</label>
      <textarea
        id="journal-note"
        value={body}
        onChange={(event) => {
          setBody(event.target.value)
          setSaved(false)
        }}
        className="mb-2 min-h-32 w-full rounded-3xl border border-brand-line bg-brand-card p-4"
        placeholder="Write about your day..."
      />
      <p className="mb-4 text-sm">Save when you’re ready</p>
      <PrimaryButton
        onClick={() => {
          update((current) => {
            const journal = current.journal.filter(entry => entry.date !== date)
            return { ...current, journal: [{ date, body }, ...journal] }
          })
          setSaved(true)
        }}
      >
        Save chat
      </PrimaryButton>
      {saved ? <p className="mt-3 text-sm font-bold">Saved for today.</p> : null}
      <Link to="/journal/past" className="mt-4 inline-block font-bold text-brand-blue">Past chats</Link>
    </main>
  )
}
