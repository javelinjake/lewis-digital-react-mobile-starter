import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { OutlineButton, PrimaryButton } from '@/components/ui'
import { ensureActivityLog, finishItemActivity } from '@/lib/activity-log'
import { contentSteps } from '@/lib/content-text'
import { activityKeys } from '@/lib/use-activity'
import { useRecipeQuery } from '@/lib/use-content'
import { refreshBalance } from '@/lib/zactivs'
import { useAuthStore } from '@/stores/auth.store'

function formatTimer(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function CookingScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const userId = useAuthStore(state => state.user?.id)
  const query = useRecipeQuery(id)
  const recipe = query.data
  const recipeId = recipe?.id
  const steps = contentSteps(recipe?.instructions)
  const [index, setIndex] = useState(0)
  const [timerOpen, setTimerOpen] = useState(false)
  const [timer, setTimer] = useState(180)
  const [running, setRunning] = useState(false)
  const safeSteps = steps.length ? steps : ['Follow the method and taste as you go.']
  const step = safeSteps[index]

  useEffect(() => {
    if (!running)
      return
    const handle = window.setInterval(() => setTimer(value => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(handle)
  }, [running])

  useEffect(() => {
    if (!userId || !recipeId)
      return
    void ensureActivityLog(userId, 'recipe', recipeId)
  }, [recipeId, userId])

  function openTimer() {
    setTimerOpen(true)
  }

  function closeTimer() {
    setRunning(false)
    setTimerOpen(false)
  }

  function adjustTimer(delta: number) {
    setRunning(false)
    setTimer(value => Math.min(59 * 60 + 59, Math.max(0, value + delta)))
  }

  if (!recipe)
    return <main className="screen"><p>Loading recipe…</p></main>

  return (
    <main className="screen screen-stack">
      <p className="text-sm font-bold">
        {recipe.name}
      </p>
      <p className="mb-2 text-sm">
        Step
        {' '}
        {index + 1}
        {' of '}
        {safeSteps.length}
      </p>
      <h1 className="mb-3 text-3xl font-bold">{step.split('.')[0]}</h1>
      <p className="mb-4 text-lg">{step}</p>

      {!timerOpen
        ? (
            <OutlineButton className="mb-4" onClick={openTimer}>
              Use a timer for this step
            </OutlineButton>
          )
        : (
            <section className="mb-4 rounded-2xl border border-brand-line bg-brand-card p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-bold">Timer</span>
                <button type="button" className="text-sm font-bold text-brand-blue" onClick={closeTimer}>
                  Hide
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" aria-label="Take one minute off" className="size-9 rounded-full bg-brand-cream font-bold" onClick={() => adjustTimer(-60)}>-1m</button>
                <button type="button" aria-label="Take ten seconds off" className="size-9 rounded-full bg-brand-cream font-bold" onClick={() => adjustTimer(-10)}>-10s</button>
                <span className="min-w-[4.5rem] text-center text-xl font-bold tabular-nums">{formatTimer(timer)}</span>
                <button type="button" aria-label="Add ten seconds" className="size-9 rounded-full bg-brand-cream font-bold" onClick={() => adjustTimer(10)}>+10s</button>
                <button type="button" aria-label="Add one minute" className="size-9 rounded-full bg-brand-cream font-bold" onClick={() => adjustTimer(60)}>+1m</button>
                <button
                  type="button"
                  className="ml-auto rounded-full bg-brand-yellow px-4 py-2 text-sm font-bold text-brand-navy"
                  onClick={() => setRunning(value => !value)}
                >
                  {running ? 'Pause' : 'Start'}
                </button>
              </div>
            </section>
          )}

      <Link to={`/recipes/${recipe.id}/ingredients`} className="mb-4 inline-block font-bold text-brand-blue">View ingredients</Link>
      <div className="grid grid-cols-2 gap-3">
        <OutlineButton disabled={index === 0} onClick={() => setIndex(value => Math.max(0, value - 1))}>Previous</OutlineButton>
        {index === safeSteps.length - 1
          ? (
              <PrimaryButton
                onClick={() => {
                  if (!recipeId)
                    return
                  void finishItemActivity('recipe', recipeId)
                    .then(async (ok) => {
                      if (!ok)
                        return
                      if (recipe?.zactivs)
                        await refreshBalance(recipe.zactivs)
                      else
                        await refreshBalance()
                      await queryClient.invalidateQueries({ queryKey: activityKeys.item('recipe', recipeId) })
                      await queryClient.invalidateQueries({ queryKey: ['activity-status', 'recipe'] })
                      navigate(`/recipes/${recipeId}/complete`)
                    })
                }}
              >
                Complete recipe
              </PrimaryButton>
            )
          : (
              <PrimaryButton onClick={() => setIndex(value => Math.min(safeSteps.length - 1, value + 1))}>Next step</PrimaryButton>
            )}
      </div>
    </main>
  )
}
