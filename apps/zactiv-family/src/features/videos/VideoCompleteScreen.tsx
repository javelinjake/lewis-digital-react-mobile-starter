import { Link, useParams } from 'react-router'
import { OutlineButton, PrimaryButton } from '@/components/ui'
import { useVideoQuery } from '@/lib/use-content'

export function VideoCompleteScreen() {
  const { id = '' } = useParams()
  const query = useVideoQuery(id)
  const video = query.data

  return (
    <main className="screen screen-stack text-center">
      <div className="mx-auto mb-4 grid size-20 place-items-center rounded-full bg-brand-yellow text-4xl font-bold">✓</div>
      <h1 className="text-4xl font-bold">Well done!</h1>
      <p className="mb-6 text-lg">
        You finished
        {' '}
        {video?.name || 'the video'}
        .
      </p>
      {video?.zactivs
        ? (
            <p className="mb-6 font-bold text-brand-blue">
              +
              {video.zactivs}
              {' Z earned'}
            </p>
          )
        : null}
      <Link to="/videos"><PrimaryButton>More videos</PrimaryButton></Link>
      <Link to="/" className="mt-3 block"><OutlineButton>Back to home</OutlineButton></Link>
    </main>
  )
}
