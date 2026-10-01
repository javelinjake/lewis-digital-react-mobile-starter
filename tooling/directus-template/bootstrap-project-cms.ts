import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { getRepoRoot } from '../lib/repo'

export async function bootstrapProjectCms(options: {
  slug: string
  packageName: string
  appRelativePath: string
  platform: 'react'
}) {
  const projectDir = join(getRepoRoot(), 'cms/projects', options.slug)
  mkdirSync(projectDir, { recursive: true })
  writeFileSync(join(projectDir, 'project.json'), `${JSON.stringify({
    platform: options.platform,
    packageName: options.packageName,
    app: options.appRelativePath,
  }, null, 2)}\n`)
  writeFileSync(join(projectDir, 'README.md'), `# ${options.slug}\n\nDirectus project for \`${options.packageName}\`.\n\nPlatform: \`${options.platform}\`.\n`)
  console.log(`Wrote cms/projects/${options.slug} (platform: ${options.platform})`)
}
