import { Capacitor } from '@capacitor/core'
import { FilePicker, type PickedFile as PluginFile } from '@capawesome/capacitor-file-picker'
import { isCancellation } from './errors'

/** Needs `capabilities.filePicker` in app.meta.ts and `@capawesome/capacitor-file-picker` in the app's package.json. */

export interface PickedFile {
  name: string
  mimeType: string
  /** Bytes. */
  size: number
  /** Reads the file's bytes. Only call it for files you will upload or parse: large files take memory. */
  read: () => Promise<Blob>
}

export interface PickFilesOptions {
  /** MIME types, e.g. `['application/pdf', 'image/*']`. Omit for any file. */
  types?: string[]
  /** Default 1. */
  limit?: number
}

function toPickedFile(file: PluginFile): PickedFile {
  return {
    name: file.name,
    mimeType: file.mimeType,
    size: file.size,
    async read() {
      if (file.blob)
        return file.blob
      const source = file.webPath ?? (file.path ? Capacitor.convertFileSrc(file.path) : undefined)
      if (!source)
        throw new Error(`No way to read ${file.name}`)
      return await (await fetch(source)).blob()
    },
  }
}

/**
 * Opens the system document picker (Files on iOS, the storage picker on Android, a file input on the web). For
 * photos, `pickPhoto` from `@ld/native` gives the photo library instead. No permission prompt is needed. Resolves
 * with an empty list when the person cancels. Never throws.
 */
export async function pickFiles(options: PickFilesOptions = {}): Promise<PickedFile[] | 'unavailable'> {
  try {
    const { files } = await FilePicker.pickFiles({ types: options.types, limit: options.limit ?? 1, readData: false })
    return files.map(toPickedFile)
  }
  catch (error) {
    return isCancellation(error) ? [] : 'unavailable'
  }
}
