import { Link } from 'react-router'
import { MediaImage } from '@/components/rich-text'
import { Icon, MediaFallback } from '@/components/ui'
import { latestActiveLog } from '@/lib/activity-log'
import { greetingFor, todayKey } from '@/lib/content-text'
import { readFamilyState } from '@/lib/family-data'
import { useRecipesQuery, useVideosQuery, useWorkoutsQuery } from '@/lib/use-content'
import { useAuthStore } from '@/stores/auth.store'

function HomeCard({
  image,
  imageFallback,
  step,
  title,
  detail,
  to,
  linkLabel,
}: {
  image?: string
  imageFallback: { icon: 'barbell' | 'fork-knife' | 'chat-circle', label: string }
  step: string
  title: string
  detail?: string
  to: string
  linkLabel: string
}) {
  return (
    <section className="overflow-hidden rounded-3xl bg-brand-card shadow-sm">
      {image
        ? <MediaImage file={image} alt="" className="aspect-[16/10] w-full object-cover" />
        : <MediaFallback icon={imageFallback.icon} label={imageFallback.label} />}
      <div className="p-4">
        <p className="text-sm font-bold text-brand-blue">{step}</p>
        <h2 className="text-xl font-bold">{title}</h2>
        {detail ? <p className="mb-3 text-sm opacity-70">{detail}</p> : null}
        <Link to={to} className={`inline-block font-bold text-brand-blue ${detail ? '' : 'mt-2'}`}>{linkLabel}</Link>
      </div>
    </section>
  )
}

export function HomeScreen() {
  const user = useAuthStore(state => state.user)
  const workouts = useWorkoutsQuery()
  const recipes = useRecipesQuery()
  const videos = useVideosQuery()
  const active = latestActiveLog()
  const workout = workouts.data?.find(item => item.id === active?.itemId) || workouts.data?.[0]
  const recipe = recipes.data?.[0]
  const video = videos.data?.find(item => item.showOnHome) || videos.data?.[0]
  const journal = user ? readFamilyState(user.id).journal.find(entry => entry.date === todayKey()) : undefined
  const familyName = user ? (readFamilyState(user.id).familyName || user.familyName || user.firstName || 'family') : 'family'

  return (
    <main className="screen">
      <h1 className="mb-6 text-4xl leading-none font-bold">
        Your
        {' '}
        {greetingFor()}
        ,
        <br />
        together
      </h1>
      <ol className="flex flex-col gap-3">
        <li>
          <HomeCard
            image={workout?.image}
            imageFallback={{ icon: 'barbell', label: 'Workouts' }}
            step="01 Move together"
            title={workout?.name || 'Workouts'}
            detail={workout?.time || 'Pick a workout for today'}
            to={workout ? `/workouts/${workout.id}` : '/workouts'}
            linkLabel={active?.itemType === 'workout' ? 'Continue workout' : 'View workout'}
          />
        </li>
        <li>
          <HomeCard
            image={recipe?.image}
            imageFallback={{ icon: 'fork-knife', label: 'Recipes' }}
            step="02 Make something tasty"
            title={recipe?.name || 'Recipes'}
            detail={recipe?.minutes ? `${recipe.minutes} min` : 'Cook together'}
            to={recipe ? `/recipes/${recipe.id}` : '/recipes'}
            linkLabel="View recipe"
          />
        </li>
        <li>
          <HomeCard
            imageFallback={{ icon: 'chat-circle', label: 'Journal' }}
            step="03 Have a little chat"
            title={journal?.body ? 'Today’s note is saved' : 'What made you smile today?'}
            to="/journal"
            linkLabel="Open chat"
          />
        </li>
      </ol>
      {video
        ? (
            <Link to={`/videos/${video.id}`} className="mt-4 block overflow-hidden rounded-3xl bg-brand-blue text-white shadow-sm">
              {video.image
                ? (
                    <div className="relative">
                      <MediaImage file={video.image} alt="" className="aspect-[16/10] w-full object-cover opacity-90" />
                      <span className="absolute inset-0 grid place-items-center">
                        <Icon name="play-circle" className="text-5xl text-white drop-shadow" />
                      </span>
                    </div>
                  )
                : null}
              <span className="flex items-center gap-3 p-4">
                {!video.image ? <Icon name="play-circle" className="text-3xl" /> : null}
                <span>
                  <span className="block font-bold">{video.name}</span>
                  <span className="text-sm opacity-80">{familyName}</span>
                </span>
              </span>
            </Link>
          )
        : null}
    </main>
  )
}
