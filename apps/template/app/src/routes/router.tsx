import { createBrowserRouter } from 'react-router'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { GuestOnly, RequireAuth } from '@/components/layout/guards'
import { StackLayout } from '@/components/layout/StackLayout'
import { TabsLayout } from '@/components/layout/TabsLayout'
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
            Component: TabsLayout,
            children: [
              { path: '/', Component: HomeRedirect },
              { path: '/home', lazy: pages.home, handle: { title: 'Home' } },
              { path: '/notes', lazy: pages.notes, handle: { title: 'Notes' } },
              { path: '/settings', lazy: pages.settings, handle: { title: 'Settings' } },
            ],
          },
          {
            Component: StackLayout,
            children: [
              { path: '/notes/:id', lazy: pages.noteDetail, handle: { title: 'Note' } },
            ],
          },
        ],
      },
      { path: '*', lazy: pages.notFound, handle: { title: 'Not found' } },
    ],
  },
])
