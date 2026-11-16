/** Decimal places of a number as written (2.5 → 1, 0.25 → 2, 5 → 0). */
export function decimalsOf(n: number): number {
  const s = String(n)
  const dot = s.indexOf('.')
  return dot < 0 ? 0 : s.length - dot - 1
}

/** Round away floating-point noise (0.1 + 0.2 → 0.3). */
export function roundTo(n: number, decimals: number): number {
  const f = 10 ** decimals
  return Math.round(n * f) / f
}

/** Turkish numeric display with a decimal comma and no grouping: 22.5 → "22,5". */
export function formatDecimal(n: number, maxDecimals = 2): string {
  return n.toLocaleString('tr-TR', { maximumFractionDigits: maxDecimals, useGrouping: false })
}

const DECIMAL_INPUT = /^(\d+([.,]\d*)?|[.,]\d*)$/

/**
 * Parse what a user typed into a numeric field. Accepts a comma or a dot as the decimal
 * separator. Returns '' for an empty (or separator-only) entry and undefined for input
 * that is not a number at all.
 */
export function parseDecimal(raw: string): number | '' | undefined {
  const s = raw.trim()
  if (s === '') return ''
  if (!DECIMAL_INPUT.test(s)) return undefined
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : ''
}
