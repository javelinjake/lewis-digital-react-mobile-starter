/** Generated placeholder for a car with no stored thumbnail yet. Same image the garage uses. */
export function fallbackThumbnailSafe(name: string): string {
  const initial = (name.trim()[0] ?? '?').toUpperCase().replace(/[<>&"']/g, '?')
  const studs = [30, 70, 110, 150].map(x => `<rect x="${x}" y="30" width="26" height="16" rx="6" fill="#ff8f3d"/>`).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="140" viewBox="0 0 200 140"><rect width="200" height="140" rx="16" fill="#0f2b52"/>${studs}<rect x="22" y="42" width="156" height="58" rx="10" fill="#ff7a1a"/><text x="100" y="86" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="38" fill="#fff">${initial}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
