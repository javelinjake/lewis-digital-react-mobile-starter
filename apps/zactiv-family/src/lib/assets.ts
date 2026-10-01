import type { DirectusFile } from '@/schemas/directus-schema'
import { getEnvConfig } from '@/config/env.config'
import { readAccessToken } from '@/lib/directus/client'

type AssetSize = 'small' | 'large' | 'original'

export function fileId(file: DirectusFile | string | null | undefined) {
  if (!file)
    return ''

  return typeof file === 'string' ? file : file.id || ''
}

export function assetUrl(file: DirectusFile | string | null | undefined, options?: { size?: AssetSize }) {
  const id = fileId(file)
  if (!id)
    return ''

  const base = getEnvConfig().VITE_DIRECTUS_URL.replace(/\/$/, '')
  const directus = new URL(base)
  let url: URL

  if (id.startsWith('http://') || id.startsWith('https://')) {
    url = new URL(id)
    if (url.origin !== directus.origin || !url.pathname.includes('/assets/'))
      return id
  }
  else if (id.startsWith('/assets/') || id.startsWith('assets/')) {
    url = new URL(id.replace(/^\//, ''), `${base}/`)
  }
  else if (id.includes('/')) {
    return id
  }
  else {
    url = new URL(`${base}/assets/${id}`)
  }

  const token = readAccessToken()
  if (token)
    url.searchParams.set('access_token', token)

  const size = options?.size ?? 'small'
  if (size === 'small')
    url.searchParams.set('key', '600w')
  else if (size === 'large')
    url.searchParams.set('key', '1200w')
  else
    url.searchParams.delete('key')

  return url.toString()
}

export function prepareHtml(html: string) {
  if (!html)
    return ''

  if (typeof DOMParser === 'undefined')
    return html

  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script, iframe, object, embed').forEach(node => node.remove())
  doc.querySelectorAll('*').forEach((node) => {
    for (const attr of [...node.attributes]) {
      if (attr.name.toLowerCase().startsWith('on'))
        node.removeAttribute(attr.name)
    }
  })

  doc.querySelectorAll('img, video, source').forEach((node) => {
    const src = node.getAttribute('src')
    if (!src)
      return

    const next = assetUrl(src, { size: node.tagName === 'IMG' ? 'small' : 'original' })
    if (next)
      node.setAttribute('src', next)
  })

  return doc.body.innerHTML
}

export function tagNames(rows: unknown, key: string) {
  if (!Array.isArray(rows))
    return []

  return rows.flatMap((row) => {
    const name = (row as Record<string, { name?: string } | undefined>)?.[key]?.name
    return name ? [name] : []
  })
}
