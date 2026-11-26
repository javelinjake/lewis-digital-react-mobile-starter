/**
 * Stands in for the Firebase web SDK (`firebase/messaging`), which `@capacitor-firebase/messaging` imports for its
 * web version. These apps do not offer web push, and `@ld/native/push` never calls the plugin in a browser, but the
 * import must still resolve for the build. Saves bundling (and installing) the Firebase SDK.
 */
function unsupported(): never {
  throw new Error('Web push is not supported in this app. @ld/native/push works on iOS and Android only.')
}

export const isSupported = async () => false
export const getMessaging = unsupported
export const getToken = unsupported
export const deleteToken = unsupported
export const onMessage = unsupported
