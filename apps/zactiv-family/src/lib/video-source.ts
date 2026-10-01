import type { DirectusFile } from '@/schemas/directus-schema'

const MIME_BY_EXT: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  ogg: 'video/ogg',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  wmv: 'video/x-ms-wmv',
  flv: 'video/x-flv',
}

export function mimeTypeFromFile(file: DirectusFile | string | null | undefined) {
  if (!file || typeof file === 'string')
    return undefined

  if (file.type)
    return file.type

  const name = file.filename_download || ''
  const ext = name.split('.').pop()?.toLowerCase()
  return ext ? MIME_BY_EXT[ext] : undefined
}

export function videoLayoutFromFile(
  file: DirectusFile | string | null | undefined,
  portraitFlag?: boolean | null,
) {
  const width = typeof file === 'object' && file?.width ? file.width : 0
  const height = typeof file === 'object' && file?.height ? file.height : 0
  const portrait = portraitFlag === true || (portraitFlag !== false && height > width && width > 0)
  const aspectRatio = width > 0 && height > 0
    ? `${width} / ${height}`
    : portrait
      ? '9 / 16'
      : '16 / 9'

  return { portrait, aspectRatio }
}

export function mimeTypeFromUrl(src: string) {
  const ext = src.split('?')[0]?.split('.').pop()?.toLowerCase()
  return ext ? MIME_BY_EXT[ext] : undefined
}
