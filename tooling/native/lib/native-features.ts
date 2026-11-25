import type { NativeCapability } from '../../../packages/config-capacitor/src/identity'

/**
 * Which `@ld/native` entry point and which plugin packages each opt-in capability needs. An app that turns a
 * capability on must declare these plugins in its own `package.json`, or `cap sync` never links them and the call
 * fails on the device with "plugin is not implemented".
 *
 * Every other plugin `@ld/native` depends on is baseline: no permission prompts, no store privacy answers, so every
 * app declares it (the template does, and `create:app` copies the template).
 */
export const NATIVE_FEATURES: Record<NativeCapability, { entry: string, plugins: string[] }> = {
  push: { entry: '@ld/native/push', plugins: ['@capacitor-firebase/messaging'] },
  location: { entry: '@ld/native/location', plugins: ['@capacitor/geolocation'] },
  biometrics: { entry: '@ld/native/biometrics', plugins: ['@aparajita/capacitor-biometric-auth'] },
  barcode: { entry: '@ld/native/barcode', plugins: ['@capacitor/barcode-scanner'] },
  audio: { entry: '@ld/native/audio', plugins: ['@capacitor-community/native-audio'] },
  filePicker: { entry: '@ld/native/file-picker', plugins: ['@capawesome/capacitor-file-picker'] },
  ota: { entry: '@ld/native/updates', plugins: ['@capgo/capacitor-updater'] },
}

export const OPT_IN_PLUGINS: ReadonlySet<string> = new Set(Object.values(NATIVE_FEATURES).flatMap(feature => feature.plugins))

/** Problems with an app's capabilities versus its declared dependencies, as messages. Empty means consistent. */
export function checkCapabilityPlugins(
  capabilities: Record<NativeCapability, boolean>,
  dependencies: Record<string, string>,
): string[] {
  const problems: string[] = []
  for (const [capability, feature] of Object.entries(NATIVE_FEATURES) as Array<[NativeCapability, typeof NATIVE_FEATURES[NativeCapability]]>) {
    const declared = feature.plugins.filter(plugin => plugin in dependencies)
    if (capabilities[capability] && declared.length < feature.plugins.length) {
      const missing = feature.plugins.filter(plugin => !(plugin in dependencies))
      problems.push(`capabilities.${capability} is on, but package.json does not declare ${missing.join(', ')}. Add it with "catalog:".`)
    }
    if (!capabilities[capability] && declared.length > 0)
      problems.push(`package.json declares ${declared.join(', ')}, but capabilities.${capability} is off in app.meta.ts. Turn it on (it adds the permissions the plugin needs) or remove the dependency.`)
  }
  return problems
}
