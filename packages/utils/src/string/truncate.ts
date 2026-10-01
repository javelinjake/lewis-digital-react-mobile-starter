export function truncate(value: string, maxLength: number, suffix = '…'): string {
  if (value.length <= maxLength)
    return value
  if (maxLength <= suffix.length)
    return suffix.slice(0, maxLength)
  return `${value.slice(0, maxLength - suffix.length)}${suffix}`
}
