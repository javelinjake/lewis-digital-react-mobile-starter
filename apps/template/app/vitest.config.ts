import { fileURLToPath } from 'node:url'
import { createVitestConfig } from '@ld/config-vitest'

export default createVitestConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
})
