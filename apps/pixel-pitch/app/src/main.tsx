import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import { validateEnv } from '@/config/env.config'
import { startTelemetry } from '@/lib/telemetry/telemetry'
import '@/assets/base.css'

const root = document.getElementById('root')

if (!root)
  throw new Error('Missing #root')

try {
  validateEnv()
  void startTelemetry()
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
catch (error) {
  root.textContent = error instanceof Error ? error.message : 'The app failed to start'
}
