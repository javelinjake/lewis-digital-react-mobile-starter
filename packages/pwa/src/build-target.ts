/** Native Capacitor bundles set VITE_BUILD_TARGET=native and must not register a service worker. */
export function isNativeBuildTarget() {
  return import.meta.env.VITE_BUILD_TARGET === 'native'
}
