import { Link, useParams } from 'react-router'
import { OutlineButton, PrimaryButton } from '@/components/ui'
import { useRecipeQuery } from '@/lib/use-content'

export function RecipeCompleteScreen() {
  const { id = '' } = useParams()
  const query = useRecipeQuery(id)
  const recipe = query.data

  return (
    <main className="screen screen-stack text-center">
      <div className="mx-auto mb-4 grid size-20 place-items-center rounded-full bg-brand-yellow text-4xl font-bold">✓</div>
      <h1 className="text-4xl font-bold">Well done!</h1>
      <p className="mb-6 text-lg">
        {recipe?.name || 'Recipe'}
        {' completed.'}
      </p>
      {recipe?.zactivs
        ? (
            <p className="mb-6 font-bold text-brand-blue">
              +
              {recipe.zactivs}
              {' Z earned'}
            </p>
          )
        : null}
      <Link to="/recipes"><PrimaryButton>More recipes</PrimaryButton></Link>
      <Link to="/" className="mt-3 block"><OutlineButton>Back to home</OutlineButton></Link>
    </main>
  )
}
