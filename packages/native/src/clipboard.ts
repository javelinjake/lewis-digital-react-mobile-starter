import { Clipboard } from '@capacitor/clipboard'

/** Copies text. Uses the system clipboard on native and the async Clipboard API on the web. Never throws. */
export async function copyText(text: string): Promise<'copied' | 'unavailable'> {
  try {
    await Clipboard.write({ string: text })
    return 'copied'
  }
  catch {
    return 'unavailable'
  }
}

/**
 * Reads text from the clipboard, or null when it is empty, not text, or the browser refused. iOS shows a "pasted
 * from" banner, so only call this when the user asked to paste.
 */
export async function readCopiedText(): Promise<string | null> {
  try {
    const { type, value } = await Clipboard.read()
    return type.startsWith('text') && value ? value : null
  }
  catch {
    return null
  }
}
