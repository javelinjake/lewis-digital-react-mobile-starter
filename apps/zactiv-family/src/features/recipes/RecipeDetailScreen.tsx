import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ContentBody, MediaImage } from '@/components/rich-text'
import { StatusBadge } from '@/components/status-badge'
import { PrimaryButton } from '@/components/ui'
import { ensureActivityLog, getActiveLog } from '@/lib/activity-log'
import { contentSteps } from '@/lib/content-text'
import { useActivityStatusQuery } from '@/lib/use-activity'
import { useRecipeQuery } from '@/lib/use-content'
import { useAuthStore } from '@/stores/auth.store'

export function RecipeDetailScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const userId = useAuthStore(state => state.user?.id)
  const query = useRecipeQuery(id)
  const [tab, setTab] = useState<'Overview' | 'Ingredients'>('Overview')
  const recipe = query.data
  const statusQuery = useActivityStatusQuery('recipe', recipe?.id)
  const activeLog = recipe ? getActiveLog('recipe', recipe.id) : null
  const status = activeLog ? 'started' : (statusQuery.data ?? null)

  if (!recipe)
    return <main className="screen"><p>{query.isPending ? 'Loading recipe…' : 'That recipe could not be found.'}</p></main>

  const ingredients = contentSteps(recipe.ingredients).slice(0, 4)

  return (
    <main className="screen screen-stack">
      {recipe.images.length
        ? (
            <div
              className="mb-4 -mr-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pr-4 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              aria-label="Recipe photos"
            >
              {recipe.images.map((file, index) => (
                <div
                  key={file}
                  className={`shrink-0 snap-center ${recipe.images.length === 1 ? 'w-full' : 'w-[88%]'}`}
                >
                  <MediaImage
                    file={file}
                    alt={index === 0 ? recipe.name : `${recipe.name} photo ${index + 1}`}
                    className="aspect-video w-full rounded-3xl bg-brand-card object-cover"
                  />
                </div>
              ))}
            </div>
          )
        : null}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-4xl font-bold">{recipe.name}</h1>
        <StatusBadge status={status} itemType="recipe" />
      </div>
      <ContentBody value={recipe.description} className="mb-3" />
      <p className="mb-4 text-sm font-bold">
        {recipe.minutes ? `${recipe.minutes} min` : 'Ready when you are'}
        {' · Serves '}
        {recipe.servings}
      </p>
      <div className="mb-4 flex gap-2">
        {(['Overview', 'Ingredients'] as const).map(item => (
          <button key={item} type="button" onClick={() => setTab(item)} className={`rounded-full px-4 py-2 font-bold ${tab === item ? 'bg-brand-blue text-white' : 'bg-brand-card'}`}>
            {item}
          </button>
        ))}
      </div>
      {tab === 'Overview'
        ? (
            <section className="mb-4 rounded-3xl bg-brand-card p-4">
              <h2 className="mb-2 font-bold">What you’ll need</h2>
              <p>{ingredients.join(' · ') || 'Ingredients are listed on the next screen.'}</p>
              <Link to={`/recipes/${recipe.id}/ingredients`} className="mt-3 inline-block font-bold text-brand-blue">View all ingredients</Link>
            </section>
          )
        : (
            <div className="mb-4 rounded-3xl bg-brand-card p-4">
              <ContentBody value={recipe.ingredients} />
            </div>
          )}
      <ContentBody value={recipe.closing} className="mb-4 text-sm" />
      <PrimaryButton
        onClick={() => {
          if (!userId || !recipe)
            return
          void ensureActivityLog(userId, 'recipe', recipe.id)
            .then(() => navigate(`/recipes/${recipe.id}/cook`))
        }}
      >
        Start cooking
      </PrimaryButton>
    </main>
  )
}
