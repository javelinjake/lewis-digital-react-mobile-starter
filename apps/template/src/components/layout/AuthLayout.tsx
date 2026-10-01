import { SafeAreaView } from '@ld/mobile-ui'
import { ThemeToggle } from '@ld/ui'
import { Outlet } from 'react-router'
import { useTheme } from '@/hooks/use-theme'

export function AuthLayout() {
  const { theme, toggleTheme } = useTheme()

  return (
    <SafeAreaView className="flex min-h-dvh flex-col bg-base-200">
      <div className="flex justify-end p-3">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </div>
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-box bg-base-100 p-6 shadow-sm">
          <Outlet />
        </div>
      </div>
    </SafeAreaView>
  )
}
