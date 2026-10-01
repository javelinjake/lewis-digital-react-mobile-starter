import { Outlet } from 'react-router'
import { NativeRuntime } from '@/app/App'

export function RootLayout() {
  return (
    <>
      <NativeRuntime />
      <Outlet />
    </>
  )
}
