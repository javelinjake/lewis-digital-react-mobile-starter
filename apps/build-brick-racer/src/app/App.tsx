import { ToastProvider } from '@ld/ui'
import { RouterProvider } from 'react-router'
import { router } from '@/routes/router'

export function App() {
  return (
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  )
}
