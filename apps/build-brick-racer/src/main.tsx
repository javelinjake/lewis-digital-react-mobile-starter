import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/assets/base.css'

const root = document.getElementById('root')

if (!root)
  throw new Error('Missing #root')

createRoot(root).render(
  <StrictMode>
    <div>Build Brick Racer</div>
  </StrictMode>,
)
