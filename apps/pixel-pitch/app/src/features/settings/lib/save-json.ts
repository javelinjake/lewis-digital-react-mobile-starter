import { share } from '@ld/native'

/** Hands a JSON document to the person: a download in the browser, the share sheet in a native app. */
export async function saveJson(filename: string, data: unknown) {
  const text = JSON.stringify(data, null, 2)

  const result = await share({ title: filename, text })
  if (result === 'shared' || result === 'cancelled')
    return

  // No share sheet (most desktop browsers): download it.
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
