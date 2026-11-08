import { Navigate } from 'react-router'
import { appConfig } from '@/config/app.config'

export function HomeRedirect() {
  return <Navigate to={appConfig.defaultRoute} replace />
}
