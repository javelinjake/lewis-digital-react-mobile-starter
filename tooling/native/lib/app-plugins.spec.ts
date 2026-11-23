import assert from 'node:assert/strict'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { pathToFileURL } from 'node:url'
import { type IdentityMeta, resolveCapabilities } from '../../../packages/config-capacitor/src/identity'
import { checkCapabilityPlugins, NATIVE_FEATURES, OPT_IN_PLUGINS } from './native-features'

/**
 * `cap sync` only links plugins the app's own package.json declares. A plugin that @ld/native imports but the app
 * does not declare still bundles (pnpm resolves it from @ld/native), then fails on the phone with "not implemented".
 * These checks keep the three lists in agreement: @ld/native's peers, each app's dependencies and its capabilities.
 */
const repoRoot = join(import.meta.dirname, '../../..')

interface PackageJson {
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  peerDependenciesMeta?: Record<string, { optional?: boolean }>
}

const read = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as PackageJson
const native = read(join(repoRoot, 'packages/native/package.json'))
const peers = Object.keys(native.peerDependencies ?? {}).filter(name => name !== 'react')
const optional = new Set(Object.entries(native.peerDependenciesMeta ?? {}).filter(([, meta]) => meta.optional).map(([name]) => name))
const baseline = peers.filter(name => !optional.has(name))

const apps = readdirSync(join(repoRoot, 'apps'))
  .map(slug => join(repoRoot, 'apps', slug, 'app'))
  .filter(dir => existsSync(join(dir, 'app.meta.ts')))

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory())
      return sourceFiles(path)
    return /\.tsx?$/.test(entry.name) ? [path] : []
  })
}

describe('@ld/native plugin lists', () => {
  it('marks exactly the opt-in plugins as optional peers', () => {
    assert.deepEqual([...optional].sort(), [...OPT_IN_PLUGINS].sort())
  })

  for (const appDir of apps) {
    const name = appDir.slice(repoRoot.length + 1)

    it(`${name} declares every baseline plugin`, () => {
      const dependencies = read(join(appDir, 'package.json')).dependencies ?? {}
      assert.deepEqual(baseline.filter(plugin => !(plugin in dependencies)), [])
    })

    it(`${name} declares the plugins for its capabilities, and no others`, async () => {
      const { appMeta } = await import(pathToFileURL(join(appDir, 'app.meta.ts')).href) as { appMeta: IdentityMeta }
      const dependencies = read(join(appDir, 'package.json')).dependencies ?? {}
      assert.deepEqual(checkCapabilityPlugins(resolveCapabilities(appMeta.capabilities), dependencies), [])
    })

    it(`${name} imports opt-in entry points statically only for capabilities it has turned on`, async () => {
      const { appMeta } = await import(pathToFileURL(join(appDir, 'app.meta.ts')).href) as { appMeta: IdentityMeta }
      const capabilities = resolveCapabilities(appMeta.capabilities)
      const offenders: string[] = []
      for (const file of sourceFiles(join(appDir, 'src'))) {
        const text = readFileSync(file, 'utf8')
        for (const [capability, feature] of Object.entries(NATIVE_FEATURES)) {
          // Allowed while off: `import type` (bundles nothing) and a lazy `import('…')` behind the capability check,
          // which is how the template keeps push ready without shipping it.
          const runtimeImport = new RegExp(`^\\s*(?:import|export)\\s+(?!type\\b)[^\\n]*['"]${feature.entry}['"]`, 'm')
          if (!capabilities[capability as keyof typeof capabilities] && runtimeImport.test(text))
            offenders.push(`${file.slice(repoRoot.length + 1)} imports ${feature.entry} but capabilities.${capability} is off`)
        }
      }
      assert.deepEqual(offenders, [])
    })
  }
})
