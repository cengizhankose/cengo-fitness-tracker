import { Cloud, CloudOff, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui'
import { useSyncStatusStore } from '@/lib/convex-sync/status'

/** Indicator for the best-effort Convex sync layer; renders nothing when sync is disabled. */
export function SyncStatusBadge() {
  const status = useSyncStatusStore((s) => s.status)

  if (status === 'disabled') return null
  if (status === 'connecting') {
    return (
      <Badge tone="neutral">
        <RefreshCw size={12} aria-hidden className="animate-spin" />
        Eşitleniyor
      </Badge>
    )
  }
  if (status === 'online') {
    return (
      <Badge tone="success" icon={Cloud}>
        Eşitlendi
      </Badge>
    )
  }
  return (
    <Badge tone="warning" icon={CloudOff}>
      Çevrimdışı
    </Badge>
  )
}
