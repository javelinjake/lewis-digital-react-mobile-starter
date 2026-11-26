import { MobileShell, ScreenContent } from '@ld/mobile-ui'
import { Link } from 'react-router'
import { ScreenHeader } from '@/components/layout/GameChrome'
import { OnboardingScreen } from '@/features/game/components/OnboardingScreen'

export function OnboardingPage() {
  return (
    <MobileShell column>
      <ScreenHeader title="Found your club" sub="Step 1 of 2 · then your first match" highlight />
      <ScreenContent>
        <div className="mx-auto flex w-full max-w-md flex-col gap-4">
          <p className="text-center text-sm">
            Already have a club on another device?
            {' '}
            <Link className="link link-primary" to="/login?redirect=/club">Sign in to the cloud</Link>
          </p>
          <OnboardingScreen />
        </div>
      </ScreenContent>
    </MobileShell>
  )
}
