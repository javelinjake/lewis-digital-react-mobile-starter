export interface FormatMoneyOptions {
  currency?: string
  locale?: string
}

export function formatMoney(
  value: number,
  options: FormatMoneyOptions = {},
): string {
  const { currency = 'GBP', locale } = options

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(value)
}
