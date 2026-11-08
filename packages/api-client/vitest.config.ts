import process from 'node:process'
import { createVitestConfig } from '@ld/config-vitest'

export default createVitestConfig({ root: process.cwd(), environment: 'node' })
