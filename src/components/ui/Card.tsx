import type { ReactNode } from 'react'
import { cx } from './cx'
import { TONE_FILL } from './tones'
import type { Tone } from './tones'

export interface CardProps {
  title?: ReactNode
  /** Right side of the header row (badge, value, small link). */
  aside?: ReactNode
  footer?: ReactNode
  /** Coloured accent stripe on the left edge. */
  tone?: Tone
  /** Drops body padding and divides children with hairlines — for ListRow lists. */
  flush?: boolean
  /** Element for the card. Default 'section'. */
  as?: 'section' | 'div' | 'article' | 'li'
  /** Heading level for `title`. Default 'h2'. */
  titleAs?: 'h2' | 'h3'
  className?: string
  children?: ReactNode
}

/** Surface block with optional header (title + aside), footer and tone stripe. */
export function Card({
  title,
  aside,
  footer,
  tone,
  flush = false,
  as: Tag = 'section',
  titleAs: Title = 'h2',
  className,
  children,
}: CardProps) {
  const hasHeader = title != null || aside != null
  return (
    <Tag className={cx('relative overflow-hidden rounded-lg border border-border bg-card', className)}>
      {tone && <span aria-hidden className={cx('absolute inset-y-0 left-0 w-1', TONE_FILL[tone])} />}
      {hasHeader && (
        <div className="flex min-h-6 items-center justify-between gap-3 px-4 pt-4 last:pb-4">
          {title != null && <Title className="min-w-0 text-base font-semibold">{title}</Title>}
          {aside != null && <div className="ml-auto shrink-0 text-sm text-text-muted">{aside}</div>}
        </div>
      )}
      {children != null &&
        (flush ? (
          <div className={cx('divide-y divide-border', hasHeader && 'mt-2')}>{children}</div>
        ) : (
          <div className={cx('px-4 pb-4', hasHeader ? 'pt-3' : 'pt-4')}>{children}</div>
        ))}
      {footer != null && <div className="border-t border-border px-4 py-3">{footer}</div>}
    </Tag>
  )
}
