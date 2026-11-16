/** Shared look of single-line text inputs (TextField, DateField) and TextArea. */
export const INPUT_CLASS =
  'w-full rounded-md border border-border bg-raised px-3 text-base text-text placeholder:text-text-faint focus-visible:border-volt focus-visible:outline-none disabled:opacity-50 aria-[invalid=true]:border-danger'

/** id of the hint/error line under a field, for aria-describedby. */
export function fieldMessageId(id: string, hint: unknown, error: unknown): string | undefined {
  if (error) return `${id}-error`
  if (hint) return `${id}-hint`
  return undefined
}
