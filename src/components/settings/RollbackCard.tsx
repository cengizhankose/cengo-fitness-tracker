import { useState } from 'react'
import { AlertTriangle, History, Undo2 } from 'lucide-react'
import { Button, Card, ConfirmDialog, Divider, Skeleton, TextField } from '@/components/ui'
import type { ImportError } from '@/lib/backup/format'
import { applySnapshot } from '@/lib/backup/import'
import type { RollbackSnapshot } from '@/lib/backup/import'
import { useToast } from '@/store/toast'
import type { BackupBusy } from './busy'
import { finishRestore } from './finishRestore'
import { ImportErrorNote } from './ImportErrorNote'
import { IMPORT_ERROR_TEXT, confirmWordMatches, formatStamp } from './importText'
import type { RestorePoints } from './useRestorePoints'

/** Typed before a rollback can even be confirmed. */
export const ROLLBACK_WORD = 'GERİ DÖN'

export interface RollbackCardProps {
  busy: BackupBusy
  onBusy: (busy: BackupBusy) => void
  points: RestorePoints
}

function recordCount(snapshot: RollbackSnapshot): number {
  const s = snapshot.state
  return (
    Object.keys(s.checklist).length +
    Object.keys(s.checkIns).length +
    s.strengthLog.length +
    s.runLog.length
  )
}

/**
 * Geri alınabilir nokta: the snapshot taken before the last import, and the safety copy
 * taken before the last rollback. Both overwrite the live data, so both are confirmed; the
 * rollback additionally needs a typed word, as it discards everything logged since.
 */
export function RollbackCard({ busy, onBusy, points }: RollbackCardProps) {
  const push = useToast((s) => s.push)
  const [armed, setArmed] = useState(false)
  const [typed, setTyped] = useState('')
  const [pending, setPending] = useState<'rollback' | 'undo' | undefined>()
  const [failure, setFailure] = useState<{ error: ImportError; dataIntact: boolean } | undefined>()
  const { snapshot, undo } = points

  function disarm() {
    setArmed(false)
    setTyped('')
  }

  async function restore(target: RollbackSnapshot) {
    onBusy('restore')
    setFailure(undefined)
    try {
      const outcome = await applySnapshot(target)
      if (!outcome.ok) {
        setFailure({ error: outcome.error, dataIntact: outcome.rolledBack })
        push(IMPORT_ERROR_TEXT[outcome.error.code], 'error')
        await points.reload()
        return
      }
      finishRestore({ added: 0, updated: 0 })
    } finally {
      setPending(undefined)
      onBusy('idle')
    }
  }

  const target = pending === 'rollback' ? snapshot : pending === 'undo' ? undo : undefined

  return (
    <Card title="Geri alınabilir nokta">
      <div className="flex flex-col gap-3">
        {!points.loaded ? (
          <Skeleton className="h-10 w-full" />
        ) : snapshot ? (
          <>
            <div>
              <p className="text-base">Kaydedildi: {formatStamp(snapshot.createdAt)}</p>
              <p className="num text-sm font-medium text-text-muted">
                {recordCount(snapshot)} kayıt · {Object.keys(snapshot.state.checkIns).length} tartı
              </p>
            </div>

            {!armed ? (
              <Button variant="secondary" fullWidth icon={History} disabled={busy !== 'idle'} onClick={() => setArmed(true)}>
                Bu noktaya dön
              </Button>
            ) : (
              <div className="flex flex-col gap-3 rounded-md border border-danger/40 bg-danger/10 p-3">
                <p className="flex items-start gap-2 text-sm text-text">
                  <AlertTriangle size={16} aria-hidden className="mt-0.5 shrink-0 text-danger" />
                  <span>
                    <span className="font-semibold">Sonraki kayıtların silinir.</span>{' '}
                    {formatStamp(snapshot.createdAt)} sonrasında girdiğin işaretler, tartılar,
                    antrenmanlar, koşular ve fotoğraflar gider. Önce şu anki verinin kopyası alınır;
                    hemen geri alabilirsin.
                  </span>
                </p>
                <TextField
                  label={`Onay için ${ROLLBACK_WORD} yaz`}
                  value={typed}
                  onChange={setTyped}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" disabled={busy === 'restore'} onClick={disarm}>
                    Vazgeç
                  </Button>
                  <Button
                    variant="danger"
                    disabled={busy !== 'idle' || !confirmWordMatches(typed, ROLLBACK_WORD)}
                    onClick={() => setPending('rollback')}
                  >
                    Geri dön
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-text-muted">Her geri yüklemeden önce otomatik kaydedilir.</p>
        )}

        {failure && <ImportErrorNote error={failure.error} dataIntact={failure.dataIntact} />}

        {undo && (
          <>
            <Divider />
            <p className="text-sm text-text-muted">
              Son geri dönüşten hemen önceki kopya · {formatStamp(undo.createdAt)}
            </p>
            <Button variant="secondary" fullWidth icon={Undo2} disabled={busy !== 'idle'} onClick={() => setPending('undo')}>
              Geri dönüşü geri al
            </Button>
          </>
        )}
      </div>

      <ConfirmDialog
        open={target !== undefined}
        title={pending === 'undo' ? 'Geri dönüş geri alınsın mı?' : 'Bu noktaya dönülsün mü?'}
        message={target && `${formatStamp(target.createdAt)} sonrasında girilen kayıtlar silinir.`}
        confirmLabel={pending === 'undo' ? 'Geri al' : 'Geri dön'}
        destructive
        loading={busy === 'restore'}
        onConfirm={() => target && void restore(target)}
        onCancel={() => setPending(undefined)}
      />
    </Card>
  )
}
