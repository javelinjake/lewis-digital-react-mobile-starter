import { SafeAreaView, ScreenContent } from '@ld/mobile-ui'
import { Link } from 'react-router'
import { OnboardingScreen } from '@/features/game/components/OnboardingScreen'

export function OnboardingPage() {
  return (
    <SafeAreaView className="flex min-h-dvh flex-col bg-base-200">
      <ScreenContent>
        <div className="mx-auto w-full max-w-md">
          <h1 className="mb-4 text-center text-primary">New club</h1>
          <OnboardingScreen />
          <p className="mt-6 text-center text-sm">
            Already have a club on another device?
            {' '}
            <Link className="link link-primary" to="/login?redirect=/club">Sign in to the cloud</Link>
          </p>
        </div>
      </ScreenContent>
    </SafeAreaView>
  )
}
