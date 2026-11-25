import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { isCancellation } from './errors'
import { isNativePlatform } from './platform'

export interface ExportFileOptions {
  filename: string
  /** Text is written as UTF-8. A Blob keeps its bytes. */
  data: string | Blob
  mimeType: string
  /** Title of the native share sheet. */
  title?: string
}

function download({ filename, data, mimeType }: ExportFileOptions) {
  const blob = typeof data === 'string' ? new Blob([data], { type: mimeType }) : data
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return btoa(binary)
}

/**
 * Hands a file to the person: a download on the web; on native, the share sheet with the file attached, where
 * "Save to Files" (iOS) or a Drive or Files app (Android) keeps it. For data exports, receipts and backups. The copy
 * written for sharing lives in the cache directory, which the OS clears. Never throws.
 */
export async function exportFile(options: ExportFileOptions): Promise<'shared' | 'cancelled' | 'unavailable'> {
  if (!isNativePlatform()) {
    try {
      download(options)
      return 'shared'
    }
    catch {
      return 'unavailable'
    }
  }

  try {
    const { uri } = typeof options.data === 'string'
      ? await Filesystem.writeFile({ path: options.filename, data: options.data, directory: Directory.Cache, encoding: Encoding.UTF8 })
      : await Filesystem.writeFile({ path: options.filename, data: await toBase64(options.data), directory: Directory.Cache })
    await Share.share({ title: options.title ?? options.filename, files: [uri] })
    return 'shared'
  }
  catch (error) {
    return isCancellation(error) ? 'cancelled' : 'unavailable'
  }
}

/**
 * Text files private to the app, kept until it is uninstalled: IndexedDB on the web, the app's data directory on
 * native. Not for anything secret (use the credential storage) and not for server data (that is the query cache's).
 * Paths are relative; folders are created as needed.
 */
export const appFiles = {
  async write(path: string, text: string): Promise<void> {
    await Filesystem.writeFile({ path, data: text, directory: Directory.Data, encoding: Encoding.UTF8, recursive: true })
  },

  /** The file's text, or null if it does not exist. */
  async read(path: string): Promise<string | null> {
    try {
      const { data } = await Filesystem.readFile({ path, directory: Directory.Data, encoding: Encoding.UTF8 })
      return typeof data === 'string' ? data : await data.text()
    }
    catch {
      return null
    }
  },

  async remove(path: string): Promise<void> {
    await Filesystem.deleteFile({ path, directory: Directory.Data }).catch(() => undefined)
  },
}
