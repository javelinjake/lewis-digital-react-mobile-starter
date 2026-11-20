import { SafeAreaView } from '@ld/mobile-ui'
import { Outlet } from 'react-router'

export function AuthLayout() {
  return (
    <SafeAreaView className="flex min-h-dvh flex-col bg-base-200">
      <div className="flex justify-center pt-10">
        <h1 className="text-primary text-sm">PIXEL PITCH</h1>
      </div>
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-box bg-base-100 p-6 shadow-sm">
          <Outlet />
        </div>
      </main>
    </SafeAreaView>
  )
}
