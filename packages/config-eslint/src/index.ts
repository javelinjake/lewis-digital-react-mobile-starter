import antfu from '@antfu/eslint-config'
import { join } from 'node:path'

export function createEslintConfig(appDir: string) {
  const sharedFolders = [
    join(appDir, 'src/components/**/*'),
    join(appDir, 'src/hooks/**/*'),
    join(appDir, 'src/config/**/*'),
    join(appDir, 'src/lib/**/*'),
    join(appDir, 'src/schemas/**/*'),
    join(appDir, 'src/stores/**/*'),
    join(appDir, 'src/types/**/*'),
    join(appDir, 'src/utils/**/*'),
    join(appDir, 'src/testing/**/*'),
  ]

  return antfu(
    {
      react: true,
      typescript: true,
    },
    {
      ignores: [
        join(appDir, 'src/schemas/directus-schema.ts'),
        'ios/**',
        'android/**',
        '.trapeze/**',
        'dev-dist/**',
        'resources/**',
      ],
    },
    {
      files: sharedFolders,
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [
            {
              group: ['**/features/**', '@/features/**'],
              message: 'Shared code must not import from features.',
            },
            {
              group: ['**/pages/**', '@/pages/**'],
              message: 'Shared code must not import from pages.',
            },
          ],
        }],
      },
    },
  )
}
