import { cx } from './cx'

export interface SkeletonProps {
  /** Size/shape classes; default a full-width text line. */
  className?: string
}

/** Pulsing placeholder block shown while content loads (hidden from assistive tech). */
export function Skeleton({ className }: SkeletonProps) {
  return <div aria-hidden className={cx('animate-pulse rounded-md bg-raised', className ?? 'h-4 w-full')} />
}
