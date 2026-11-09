import { createBrowserRouter } from 'react-router'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { GuestOnly, RequireAuth } from '@/components/layout/guards'
import { StackLayout } from '@/components/layout/StackLayout'
import { TabsLayout } from '@/components/layout/TabsLayout'
import { ClubGate, NoClubGate } from '@/features/game/components/ClubGate'
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
                Component: TabsLayout,
                children: [
                  { path: '/', Component: HomeRedirect },
                  { path: '/club', lazy: pages.club, handle: { title: 'Club' } },
                  { path: '/packs', lazy: pages.packs, handle: { title: 'Packs' } },
                  { path: '/squad', lazy: pages.squad, handle: { title: 'Squad' } },
                  { path: '/league', lazy: pages.league, handle: { title: 'League' } },
                  { path: '/settings', lazy: pages.settings, handle: { title: 'Settings' } },
                ],
              },
              {
                Component: StackLayout,
                children: [{ path: '/match/:no', lazy: pages.match, handle: { title: 'Match' } }],
              },
            ],
          },
        ],
      },
      { path: '*', lazy: pages.notFound, handle: { title: 'Not found' } },
    ],
  },
])
