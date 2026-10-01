import { Share } from '@capacitor/share'

export interface SharePayload {
  title?: string
  text?: string
  url?: string
  dialogTitle?: string
}

/** Native share sheet, or the Web Share API. Never throws for cancel/unavailable. */
export async function share(payload: SharePayload): Promise<'shared' | 'cancelled' | 'unavailable'> {
  try {
    const { value } = await Share.canShare()
    if (!value)
      return 'unavailable'

    await Share.share(payload)
    return 'shared'
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/cancel|abort/i.test(message))
      return 'cancelled'

    return 'unavailable'
  }
}
