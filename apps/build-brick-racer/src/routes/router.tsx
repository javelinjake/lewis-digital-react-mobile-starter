import { createBrowserRouter } from 'react-router'
import { RootLayout } from '@/components/layout/RootLayout'
import { BuilderPage } from '@/pages/BuilderPage'
import { ChallengesPage } from '@/pages/ChallengesPage'
import { DrivePage } from '@/pages/DrivePage'
import { GaragePage } from '@/pages/GaragePage'
import { HelpPage } from '@/pages/HelpPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ReadyPage } from '@/pages/ReadyPage'
import { ReplayPage } from '@/pages/ReplayPage'
import { ResultDetailsPage } from '@/pages/ResultDetailsPage'
import { ResultsPage } from '@/pages/ResultsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { StartersPage } from '@/pages/StartersPage'

/**
 * Navigation states: Garage, Starter selection, Builder, Challenge selection, Pre-run, Driving (with
 * Pause as an overlay), Results (+ details) and Replay. Each screen releases its input handlers and
 * runtime objects when it unmounts.
 */
export const router = createBrowserRouter([
  {
    Component: RootLayout,
    children: [
      { path: '/', Component: GaragePage, handle: { title: 'My Garage' } },
      { path: '/starters', Component: StartersPage, handle: { title: 'Choose your starter' } },
      { path: '/build/:carId', Component: BuilderPage, handle: { title: 'Builder' } },
      { path: '/play', Component: ChallengesPage, handle: { title: 'Choose a challenge' } },
      { path: '/ready', Component: ReadyPage, handle: { title: 'Ready to drive?' } },
      { path: '/drive', Component: DrivePage, handle: { title: 'Drive' } },
      { path: '/results/:runId', Component: ResultsPage, handle: { title: 'Results' } },
      { path: '/results/:runId/details', Component: ResultDetailsPage, handle: { title: 'Run details' } },
      { path: '/replay/:runId', Component: ReplayPage, handle: { title: 'Replay' } },
      { path: '/settings', Component: SettingsPage, handle: { title: 'Settings' } },
      { path: '/help', Component: HelpPage, handle: { title: 'Help' } },
      { path: '*', Component: NotFoundPage, handle: { title: 'Not found' } },
    ],
  },
])
