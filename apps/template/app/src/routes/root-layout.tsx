import { Outlet } from 'react-router'
import { NativeRuntime, UpdatePrompt } from '@/app/App'

export function RootLayout() {
  return (
    <>
      <NativeRuntime />
      <Outlet />
      <UpdatePrompt />
    </>
  )
}
