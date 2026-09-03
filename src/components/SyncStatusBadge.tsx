import { Cloud, CloudOff, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { useSyncStatusStore } from '@/lib/convex-sync'

/** Subtle indicator for the best-effort Convex sync layer. Renders nothing when sync is
 *  disabled (no backend configured) — the vast majority of local-only usage. */
export function SyncStatusBadge() {
  const status = useSyncStatusStore((s) => s.status)

  if (status === 'disabled') return null

  if (status === 'connecting') {
    return (
      <Badge tone="muted">
        <RefreshCw size={12} className="animate-spin" />
        Syncing
      </Badge>
    )
  }

  if (status === 'online') {
    return (
      <Badge tone="success">
        <Cloud size={12} />
        Synced
      </Badge>
    )
  }

  return (
    <Badge tone="heat">
      <CloudOff size={12} />
      Offline
    </Badge>
  )
}
