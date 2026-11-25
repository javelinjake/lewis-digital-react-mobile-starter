/**
 * Raises `minSdkVersion` in a Capacitor `android/variables.gradle` to at least `min`. Never lowers it, so a value
 * set by hand for another reason survives. Returns the text unchanged when there is nothing to do.
 */
export function raiseMinSdk(variablesGradle: string, min: number): string {
  return variablesGradle.replace(/(minSdkVersion\s*=\s*)(\d+)/, (match, prefix: string, value: string) =>
    Number(value) >= min ? match : `${prefix}${min}`)
}

/** Android minimum each capability needs beyond Capacitor's own (API 24). */
export const MIN_SDK_FOR = {
  /** @capacitor/barcode-scanner. */
  barcode: 26,
} as const
