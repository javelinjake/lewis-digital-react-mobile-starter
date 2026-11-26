import { createBrowserRouter } from 'react-router'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { GuestOnly, RequireAuth } from '@/components/layout/guards'
import { StackLayout } from '@/components/layout/StackLayout'
import { ClubGate, NoClubGate } from '@/features/game/components/ClubGate'
import { GameTabs } from '@/features/game/components/GameTabs'
import { HomeRedirect } from '@/pages/HomeRedirect'
import { RootLayout } from '@/routes/root-layout'
import { pages } from './pages'

export const router = createBrowserRouter([
  {
    Component: RootLayout,
    children: [
      {
        Component: GuestOnly,
        children: [
          {
            Component: AuthLayout,
            children: [
              { path: '/login', lazy: pages.login, handle: { title: 'Sign in' } },
              { path: '/register', lazy: pages.register, handle: { title: 'Create account' } },
              { path: '/forgot-password', lazy: pages.forgotPassword, handle: { title: 'Reset password' } },
              { path: '/reset-password', lazy: pages.resetPassword, handle: { title: 'New password' } },
            ],
          },
        ],
      },
      {
        Component: RequireAuth,
        children: [
          {
            Component: NoClubGate,
            children: [{ path: '/onboarding', lazy: pages.onboarding, handle: { title: 'New club' } }],
          },
          {
            Component: ClubGate,
            children: [
              {
                Component: GameTabs,
                children: [
                  { path: '/', Component: HomeRedirect },
                  { path: '/club', lazy: pages.club, handle: { title: 'Club' } },
                  { path: '/packs', lazy: pages.packs, handle: { title: 'Packs' } },
                  { path: '/squad', lazy: pages.squad, handle: { title: 'Squad' } },
                  { path: '/arcade', lazy: pages.arcade, handle: { title: 'Arcade' } },
                  { path: '/league', lazy: pages.league, handle: { title: 'League' } },
                ],
              },
              {
                Component: StackLayout,
                children: [
                  { path: '/match/:no', lazy: pages.match, handle: { title: 'Match' } },
                  { path: '/chances', lazy: pages.chances, handle: { title: 'Big Chances' } },
                  { path: '/goals', lazy: pages.goals, handle: { title: 'Goals' } },
                  { path: '/pass', lazy: pages.pass, handle: { title: 'League Pass' } },
                  { path: '/album', lazy: pages.album, handle: { title: 'Album' } },
                  { path: '/settings', lazy: pages.settings, handle: { title: 'Settings' } },
                  // The back button on a game goes to the arcade, wherever the game was opened from.
                  { path: '/arcade/:cabinet', lazy: pages.arcadePlay, handle: { title: 'Arcade', backTo: '/arcade' } },
                ],
              },
            ],
          },
        ],
      },
      { path: '*', lazy: pages.notFound, handle: { title: 'Not found' } },
    ],
  },
])
