import { InAppReview } from '@capacitor-community/in-app-review'
import { isNativePlatform } from './platform'

/**
 * Asks the store to show its rating prompt (SKStoreReviewController / Play In-App Review). The OS decides whether
 * it appears: Apple shows it at most three times a year and Google applies a quota, and neither tells the app.
 * So call it after a moment of success, never from a button labelled "Rate us". No-op on the web. Never throws.
 */
export async function requestStoreReview(): Promise<void> {
  if (!isNativePlatform())
    return
  try {
    await InAppReview.requestReview()
  }
  catch {
    // A review prompt is a nicety; failing to show one is not an error the user should see.
  }
}
