import { exportFile } from '@ld/native'

/** Hands a JSON document to the person: a download in the browser, the share sheet with the file in a native app. */
export async function saveJson(filename: string, data: unknown) {
  await exportFile({ filename, data: JSON.stringify(data, null, 2), mimeType: 'application/json' })
}
