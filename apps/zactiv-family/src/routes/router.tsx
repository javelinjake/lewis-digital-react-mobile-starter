import { createBrowserRouter } from 'react-router'
import { AppShell, useDocumentTitle } from '@/components/shell'
import { CmsPage } from '@/pages/CmsPage'
import { CookingPage } from '@/pages/CookingPage'
import { FamilyPage } from '@/pages/FamilyPage'
import { ForbiddenPage } from '@/pages/ForbiddenPage'
import { HomePage } from '@/pages/HomePage'
import { IngredientsPage } from '@/pages/IngredientsPage'
import { JournalPage } from '@/pages/JournalPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { PastChatsPage } from '@/pages/PastChatsPage'
import { RecipeCompletePage } from '@/pages/RecipeCompletePage'
import { RecipeDetailPage } from '@/pages/RecipeDetailPage'
import { RecipesPage } from '@/pages/RecipesPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { VerificationPage } from '@/pages/VerificationPage'
import { VideoCompletePage } from '@/pages/VideoCompletePage'
import { VideoPlayerPage } from '@/pages/VideoPlayerPage'
import { VideosPage } from '@/pages/VideosPage'
import { WelcomePage } from '@/pages/WelcomePage'
import { WorkoutCompletePage } from '@/pages/WorkoutCompletePage'
import { WorkoutDetailPage } from '@/pages/WorkoutDetailPage'
import { WorkoutSessionPage } from '@/pages/WorkoutSessionPage'
import { WorkoutsPage } from '@/pages/WorkoutsPage'
import { GuestOnly, RequireAuth } from '@/routes/guards'
import { RootLayout } from '@/routes/root-layout'

function Root() {
  useDocumentTitle()
  return <AppShell />
}

export const router = createBrowserRouter([
  {
    Component: RootLayout,
    children: [
      {
        Component: Root,
        children: [
          {
            Component: GuestOnly,
            children: [
              { path: '/login', Component: LoginPage, handle: { title: 'Sign in', guestOnly: true } },
              { path: '/register', Component: RegisterPage, handle: { title: 'Register', guestOnly: true } },
              { path: '/verification', Component: VerificationPage, handle: { title: 'Verification', guestOnly: true } },
            ],
          },
          {
            Component: RequireAuth,
            children: [
              { path: '/', Component: HomePage, handle: { title: 'Home', showTabs: true, requiresAuth: true } },
              { path: '/workouts', Component: WorkoutsPage, handle: { title: 'Workouts', showTabs: true, requiresAuth: true } },
              { path: '/workouts/:id', Component: WorkoutDetailPage, handle: { title: 'Workout', requiresAuth: true } },
              { path: '/workouts/:id/session', Component: WorkoutSessionPage, handle: { title: 'Workout', requiresAuth: true } },
              { path: '/workouts/:id/complete', Component: WorkoutCompletePage, handle: { title: 'Workout complete', requiresAuth: true } },
              { path: '/recipes', Component: RecipesPage, handle: { title: 'Recipes', showTabs: true, requiresAuth: true } },
              { path: '/recipes/:id', Component: RecipeDetailPage, handle: { title: 'Recipe', requiresAuth: true } },
              { path: '/recipes/:id/ingredients', Component: IngredientsPage, handle: { title: 'Ingredients', requiresAuth: true } },
              { path: '/recipes/:id/cook', Component: CookingPage, handle: { title: 'Cooking', requiresAuth: true } },
              { path: '/recipes/:id/complete', Component: RecipeCompletePage, handle: { title: 'Recipe complete', requiresAuth: true } },
              { path: '/videos', Component: VideosPage, handle: { title: 'Videos', showTabs: true, requiresAuth: true } },
              { path: '/videos/:id', Component: VideoPlayerPage, handle: { title: 'Video', requiresAuth: true } },
              { path: '/videos/:id/complete', Component: VideoCompletePage, handle: { title: 'Video complete', requiresAuth: true } },
              { path: '/journal', Component: JournalPage, handle: { title: 'Journal', showTabs: true, requiresAuth: true } },
              { path: '/journal/past', Component: PastChatsPage, handle: { title: 'Past chats', requiresAuth: true } },
              { path: '/family', Component: FamilyPage, handle: { title: 'Your family', requiresAuth: true } },
              { path: '/settings', Component: SettingsPage, handle: { title: 'Settings', requiresAuth: true } },
              { path: '/welcome', Component: WelcomePage, handle: { title: 'Welcome', requiresAuth: true } },
              { path: '/not-authorized', Component: ForbiddenPage, handle: { title: 'Not authorized' } },
            ],
          },
          { path: '/:slug', Component: CmsPage, handle: { title: 'Page' } },
          { path: '*', Component: NotFoundPage, handle: { title: 'Not found' } },
        ],
      },
    ],
  },
])
