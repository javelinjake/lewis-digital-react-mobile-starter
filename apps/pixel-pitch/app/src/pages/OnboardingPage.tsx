import { SafeAreaView, ScreenContent } from '@ld/mobile-ui'
import { OnboardingScreen } from '@/features/game/components/OnboardingScreen'

export function OnboardingPage() {
  return (
    <SafeAreaView className="flex min-h-dvh flex-col bg-base-200">
      <ScreenContent>
        <h1 className="mb-4 text-center text-primary">New club</h1>
        <OnboardingScreen />
      </ScreenContent>
    </SafeAreaView>
  )
}
