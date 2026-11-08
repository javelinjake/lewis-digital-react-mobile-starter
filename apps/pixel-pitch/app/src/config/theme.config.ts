export type AppTheme = 'cmyk' | 'dracula'

export function isAppTheme(value: string | null): value is AppTheme {
  return value === 'cmyk' || value === 'dracula'
}
