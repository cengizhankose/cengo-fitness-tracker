import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { To } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cx } from './cx'

export interface ListRowProps {
  title: ReactNode
  subtitle?: ReactNode
  /** Left slot (icon, badge). */
  leading?: ReactNode
  /** Right slot (value, badge, sparkline). Must not be interactive. */
  trailing?: ReactNode
  /** Renders a router link. */
  to?: To
  /** Renders a button (ignored when `to` is set). */
  onClick?: () => void
  /** Show the chevron. Default: true when the row is a link or button. */
  chevron?: boolean
  className?: string
}

/** Full-width list row; a link (`to`), a button (`onClick`) or static. */
export function ListRow({ title, subtitle, leading, trailing, to, onClick, chevron, className }: ListRowProps) {
  const interactive = to !== undefined || onClick !== undefined
  const classes = cx(
    'flex min-h-tap-lg w-full items-center gap-3 px-4 py-2.5 text-left',
    interactive && 'transition-colors active:bg-raised',
    className,
  )
  const body = (
    <>
      {leading != null && <span className="flex shrink-0 items-center">{leading}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-medium">{title}</span>
        {subtitle != null && <span className="block truncate text-sm text-text-muted">{subtitle}</span>}
      </span>
      {trailing != null && <span className="flex shrink-0 items-center gap-2 text-right">{trailing}</span>}
      {(chevron ?? interactive) && (
        <ChevronRight size={20} aria-hidden className="-mr-1 shrink-0 text-text-faint" />
      )}
    </>
  )
  if (to !== undefined) {
    return (
      <Link to={to} className={classes}>
        {body}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {body}
      </button>
    )
  }
  return <div className={classes}>{body}</div>
}
