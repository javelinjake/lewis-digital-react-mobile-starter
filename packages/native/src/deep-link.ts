/** `https://app.example.com/orders/12?x=1` → `/orders/12?x=1` */
export function deepLinkToPath(url: string): string | null {
  try {
    const parsed = new URL(url)
    const isWeb = parsed.protocol === 'http:' || parsed.protocol === 'https:'
    const path = isWeb ? parsed.pathname : `/${parsed.host}${parsed.pathname}`
    return `${path}${parsed.search}${parsed.hash}`.replace(/\/+$/, '') || '/'
  }
  catch {
    return null
  }
}
