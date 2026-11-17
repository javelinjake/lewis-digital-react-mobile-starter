import { Outlet } from 'react-router'
import { NativeRuntime } from '@/app/NativeRuntime'
import { UpdatePrompt } from '@/app/UpdatePrompt'
import { useBoot } from '@/app/use-boot'
import { RotatePrompt } from '@/components/ui/RotatePrompt'

export function RootLayout() {
  useBoot()
  return (
    <>
      <NativeRuntime />
      <Outlet />
      <UpdatePrompt />
      <RotatePrompt />
    </>
  )
}
