import type { ReactNode } from 'react'

export interface SectionTitleProps {
  children: ReactNode
  /** Right-aligned extra (count, small link). */
  aside?: ReactNode
  /** Default 'h2'. */
  as?: 'h2' | 'h3'
  id?: string
}

/** Small uppercase label that introduces a group of cards. */
export function SectionTitle({ children, aside, as: Tag = 'h2', id }: SectionTitleProps) {
  return (
    <div className="flex items-center justify-between gap-3 px-1 pt-2">
      <Tag id={id} className="text-xs font-semibold uppercase tracking-wider text-text-muted">
        {children}
      </Tag>
      {aside != null && <div className="text-sm text-text-muted">{aside}</div>}
    </div>
  )
}
