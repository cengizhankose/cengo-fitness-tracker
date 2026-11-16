import { cx } from './cx'

export interface DividerProps {
  /** Optional centred text, e.g. "veya". */
  label?: string
  className?: string
}

/** Hairline separator, optionally with a centred label. */
export function Divider({ label, className }: DividerProps) {
  if (!label) return <hr className={cx('border-0 border-t border-border', className)} />
  return (
    <div role="separator" aria-label={label} className={cx('flex items-center gap-3', className)}>
      <span aria-hidden className="h-px flex-1 bg-border" />
      <span aria-hidden className="text-xs font-medium text-text-faint">{label}</span>
      <span aria-hidden className="h-px flex-1 bg-border" />
    </div>
  )
}
