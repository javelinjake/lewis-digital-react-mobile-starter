import { hasCompletedOnboarding } from '@/lib/family-data'

export function destinationFor(status: 'authenticated' | 'anonymous', path: string) {
  if (status !== 'authenticated')
    return '/login'

  const onboarded = hasCompletedOnboarding()
  if (!onboarded && path !== '/welcome' && !path.startsWith('/videos/'))
    return '/welcome'

  return path
}
