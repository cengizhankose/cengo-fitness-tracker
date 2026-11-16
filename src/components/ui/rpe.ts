/** RPE effort scale offered by RpePicker, each with a short Turkish word. */
export const RPE_SCALE = [
  { value: 6, word: 'çok kolay' },
  { value: 7, word: 'kolay' },
  { value: 8, word: 'orta' },
  { value: 9, word: 'zor' },
  { value: 10, word: 'tükeniş' },
] as const

/** Turkish word for an RPE value (rounded down to the scale), e.g. 8 → "orta". */
export function rpeWord(rpe: number): string | undefined {
  return RPE_SCALE.find((s) => s.value === Math.floor(rpe))?.word
}
