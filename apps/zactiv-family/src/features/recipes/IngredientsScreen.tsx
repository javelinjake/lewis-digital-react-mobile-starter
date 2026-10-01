import { Link, useParams } from 'react-router'
import { PrimaryButton } from '@/components/ui'
import { contentSteps, scaleAmount } from '@/lib/content-text'
import { useRecipeQuery } from '@/lib/use-content'
import { useFamilyState } from '@/lib/use-family-state'

export function IngredientsScreen() {
  const { id = '' } = useParams()
  const query = useRecipeQuery(id)
  const { state, update } = useFamilyState()
  const recipe = query.data
  const servings = state.checks[`${id}:servings`]?.[0]
  const count = Number(servings || recipe?.servings || 2)
  const factor = recipe?.servings ? count / recipe.servings : 1
  const lines = contentSteps(recipe?.ingredients)
  const checked = new Set(state.checks[id] ?? [])

  if (!recipe)
    return <main className="screen"><p>Loading ingredients…</p></main>

  function setCount(next: number) {
    update(current => ({
      ...current,
      checks: { ...current.checks, [`${id}:servings`]: [String(Math.max(1, next))] },
    }))
  }

  return (
    <main className="screen screen-stack">
      <h1 className="text-4xl font-bold">Ingredients</h1>
      <p className="mb-4">{recipe.name}</p>
      <div className="mb-4 flex items-center justify-between rounded-3xl bg-brand-card p-4">
        <span className="font-bold">Serves</span>
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Fewer servings" className="size-10 rounded-full bg-brand-cream font-bold" onClick={() => setCount(count - 1)}>-</button>
          <span className="text-xl font-bold">{count}</span>
          <button type="button" aria-label="More servings" className="size-10 rounded-full bg-brand-cream font-bold" onClick={() => setCount(count + 1)}>+</button>
        </div>
      </div>
      <ul className="mb-4 flex flex-col gap-2">
        {lines.map((line) => {
          const on = checked.has(line)
          return (
            <li key={line}>
              <label className="flex items-center gap-3 rounded-2xl bg-brand-card px-4 py-3">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => update((current) => {
                    const existing = new Set(current.checks[id] ?? [])
                    if (existing.has(line))
                      existing.delete(line)
                    else
                      existing.add(line)
                    return { ...current, checks: { ...current.checks, [id]: [...existing] } }
                  })}
                />
                <span className={on ? 'line-through opacity-60' : ''}>{scaleAmount(line, factor)}</span>
              </label>
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        className="mb-4 font-bold text-brand-blue"
        onClick={() => update(current => ({ ...current, checks: { ...current.checks, [id]: [] } }))}
      >
        Clear checks
      </button>
      <p className="mb-4 text-sm">Checks stay with this recipe.</p>
      <Link to={`/recipes/${recipe.id}/cook`}><PrimaryButton>Start cooking</PrimaryButton></Link>
    </main>
  )
}
