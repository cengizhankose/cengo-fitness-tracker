import { useState } from 'react'
import { Screen } from '@/components/ui'
import { AboutCard } from '@/components/settings/AboutCard'
import { BackupCard } from '@/components/settings/BackupCard'
import type { BackupBusy } from '@/components/settings/busy'
import { RestoreCard } from '@/components/settings/RestoreCard'
import { RollbackCard } from '@/components/settings/RollbackCard'
import { SyncCard } from '@/components/settings/SyncCard'
import { useRestorePoints } from '@/components/settings/useRestorePoints'

/** Ayarlar: sync state, backup export/restore, the rollback point and plan/data versions. */
export function SettingsScreen() {
  // One backup operation at a time across all cards.
  const [busy, setBusy] = useState<BackupBusy>('idle')
  const [staged, setStaged] = useState(false)
  const points = useRestorePoints()

  return (
    <Screen title="Ayarlar" back="/">
      <SyncCard />
      <BackupCard busy={busy} onBusy={setBusy} primary={!staged} />
      <RestoreCard
        busy={busy}
        onBusy={setBusy}
        onStagedChange={setStaged}
        onRestorePointsChanged={points.reload}
      />
      <RollbackCard busy={busy} onBusy={setBusy} points={points} />
      <AboutCard />
    </Screen>
  )
}
