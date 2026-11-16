import { CloudOff } from 'lucide-react'
import { Badge, Card } from '@/components/ui'
import { SyncStatusBadge } from '@/components/SyncStatusBadge'
import { useSyncStatusStore } from '@/lib/convex-sync/status'
import { formatStamp } from './importText'

/** Sync state badge plus one line saying what it means for the data on this phone. */
export function SyncCard() {
  const status = useSyncStatusStore((s) => s.status)
  const lastSyncedAt = useSyncStatusStore((s) => s.lastSyncedAt)

  let line: string
  switch (status) {
    case 'disabled':
      line = 'Eşitleme ayarlı değil; veriler yalnızca bu telefonda. Düzenli yedek al.'
      break
    case 'connecting':
      line = 'Sunucuyla eşitleniyor.'
      break
    case 'online':
      line = lastSyncedAt ? `Son eşitleme: ${formatStamp(lastSyncedAt)}.` : 'Sunucuyla eşit.'
      break
    case 'offline':
      line = 'Sunucuya ulaşılamıyor; kayıtların telefonda duruyor, bağlantı gelince gönderilir.'
      break
  }

  return (
    <Card
      title="Eşitleme"
      aside={
        status === 'disabled' ? (
          <Badge tone="neutral" icon={CloudOff}>
            Kapalı
          </Badge>
        ) : (
          <SyncStatusBadge />
        )
      }
    >
      <p className="text-sm text-text-muted">{line}</p>
    </Card>
  )
}
