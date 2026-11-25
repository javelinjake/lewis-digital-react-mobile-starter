import type { GameResponse } from '@ld/pixel-pitch-core'
import { useEffect } from 'react'
import { Link } from 'react-router'
import { telemetry } from '@/lib/telemetry/telemetry'
import { firstSteps } from '../lib/first-steps'

const RECORDED_KEY = 'pp-first-steps'

function recorded(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECORDED_KEY) ?? '[]') as string[]
  }
  catch {
    return []
  }
}

/** A new player's checklist, with the next step highlighted. Gone once everything is done. */
export function FirstSteps({ game }: { game: GameResponse }) {
  const steps = firstSteps(game)
  const next = steps.find(step => !step.done)

  // Each step is recorded once, when it is first seen done: where new players stop is the soft launch's main question.
  useEffect(() => {
    const seen = recorded()
    const fresh = steps.filter(step => step.done && !seen.includes(step.id))
    if (fresh.length === 0)
      return
    for (const step of fresh)
      telemetry.track('first_step_done', { step: step.id })
    try {
      localStorage.setItem(RECORDED_KEY, JSON.stringify([...seen, ...fresh.map(step => step.id)]))
    }
    catch {
      // Private mode: the events may be recorded again next time, which is harmless.
    }
  }, [steps])

  if (!next)
    return null

  return (
    <section className="flex flex-col gap-2 border-2 border-accent bg-base-100 p-3" aria-label="Getting started">
      <div className="flex items-baseline justify-between">
        <h2>Getting started</h2>
        <span className="text-muted">{`${steps.filter(step => step.done).length}/${steps.length}`}</span>
      </div>
      <ol className="flex flex-col gap-1">
        {steps.map(step => (
          <li key={step.id} className={step.done ? 'text-muted line-through' : step === next ? 'text-lg text-accent' : ''}>
            {`${step.done ? '✓' : step === next ? '›' : '·'} ${step.label}`}
          </li>
        ))}
      </ol>
      <Link to={next.to} className="btn btn-accent min-h-11 font-display text-xs">{next.label}</Link>
    </section>
  )
}
