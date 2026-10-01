export function splitLines(value: string | null | undefined): string[] {
  if (!value?.trim())
    return []

  const lines = value
    .split(/\r?\n/)
    .map(line => line.replace(/^(?:[-*]\s+|\d+[.)]\s+)/, '').trim())
    .filter(Boolean)

  return lines.length > 0 ? lines : [value.trim()]
}

const htmlTag = /<\/?[a-z][^>]*>/i

export function isHtml(value: string | null | undefined) {
  return htmlTag.test(value || '')
}

export function contentSteps(value: string | null | undefined): string[] {
  if (!value?.trim())
    return []

  if (!isHtml(value) || typeof DOMParser === 'undefined')
    return splitLines(value)

  const doc = new DOMParser().parseFromString(value, 'text/html')
  const items = [...doc.querySelectorAll('li')]
    .map(item => item.textContent?.replace(/\s+/g, ' ').trim() || '')
    .filter(Boolean)

  if (items.length)
    return items

  const paragraphs = [...doc.querySelectorAll('p')]
    .map(item => item.textContent?.replace(/\s+/g, ' ').trim() || '')
    .filter(Boolean)

  return paragraphs.length ? paragraphs : splitLines(value.replace(/<[^>]+>/g, ' '))
}

export function parseMinutes(value: string | null | undefined): number | null {
  if (!value)
    return null

  const match = value.match(/(\d+)/)
  return match ? Number(match[1]) : null
}

export function parseSeconds(value: string): number | null {
  const minute = value.match(/(\d+)\s*(?:-\s*)?minute/)
  if (minute)
    return Number(minute[1]) * 60

  const second = value.match(/(\d+)\s*(?:seconds?|s)\b/)
  if (second)
    return Number(second[1])

  return null
}

export function defaultWarmupSeconds(warmUpHtml: string) {
  const fromSteps = warmUpHtml.match(/\((\d+)\s*s\)/i)
  if (fromSteps)
    return Number(fromSteps[1])

  return parseSeconds(warmUpHtml) ?? 30
}

export function greetingFor(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12)
    return 'morning'
  if (hour < 18)
    return 'afternoon'
  return 'evening'
}

export function formatLongDate(iso: string) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(iso))
}

export function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

export function scaleAmount(line: string, factor: number) {
  return line.replace(/(\d+(?:\.\d+)?)/, (raw) => {
    const next = Number(raw) * factor
    const rounded = Math.round(next * 10) / 10
    return Number.isInteger(rounded) ? String(rounded) : String(rounded)
  })
}
