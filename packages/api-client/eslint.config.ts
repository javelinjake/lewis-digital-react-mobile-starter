import process from 'node:process'
import { createEslintConfig } from '@ld/config-eslint'

export default createEslintConfig(process.cwd())
