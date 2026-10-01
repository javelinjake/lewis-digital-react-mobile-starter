import { createBrowserRouter } from 'react-router'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { GuestOnly, RequireAuth } from '@/components/layout/guards'
import { StackLayout } from '@/components/layout/StackLayout'
import { TabsLayout } from '@/components/layout/TabsLayout'
import { HomePage } from '@/pages/HomePage'
import { HomeRedirect } from '@/pages/HomeRedirect'
import { LoginPage } from '@/pages/LoginPage'
import { NoteDetailPage } from '@/pages/NoteDetailPage'
import { NotesPage } from '@/pages/NotesPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { RootLayout } from '@/routes/root-layout'

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
              { path: '/login', Component: LoginPage, handle: { title: 'Sign in' } },
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
              { path: '/home', Component: HomePage, handle: { title: 'Home' } },
              { path: '/notes', Component: NotesPage, handle: { title: 'Notes' } },
              { path: '/settings', Component: SettingsPage, handle: { title: 'Settings' } },
            ],
          },
          {
            Component: StackLayout,
            children: [
              { path: '/notes/:id', Component: NoteDetailPage, handle: { title: 'Note' } },
            ],
          },
        ],
      },
      { path: '*', Component: NotFoundPage, handle: { title: 'Not found' } },
    ],
  },
])
