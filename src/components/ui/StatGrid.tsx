import type { ReactNode } from 'react'
import { cx } from './cx'

export interface StatGridProps {
  children: ReactNode
  /** Default 2. */
  cols?: 2 | 3
  className?: string
}

/** Even grid of Stat blocks. */
export function StatGrid({ children, cols = 2, className }: StatGridProps) {
  return (
    <div className={cx('grid gap-x-4 gap-y-5', cols === 3 ? 'grid-cols-3' : 'grid-cols-2', className)}>
      {children}
    </div>
  )
}
