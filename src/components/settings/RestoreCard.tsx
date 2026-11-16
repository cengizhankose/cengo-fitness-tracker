import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Upload } from 'lucide-react'
import { Button, Card, ConfirmDialog, SegmentedControl, TextField } from '@/components/ui'
import type { DecodedBackup, ImportError } from '@/lib/backup/format'
import { applyBackup, previewImport, readBackupFile } from '@/lib/backup/import'
import type { ImportPreview } from '@/lib/backup/import'
import type { ImportMode } from '@/lib/backup/merge'
import { pickPersisted, useStore } from '@/store'
import type { PersistedState } from '@/store'
import { useToast } from '@/store/toast'
import type { BackupBusy } from './busy'
import { finishRestore } from './finishRestore'
import { ImportErrorNote } from './ImportErrorNote'
import { ImportPreviewTable } from './ImportPreviewTable'
import { IMPORT_ERROR_TEXT, confirmWordMatches, formatStamp } from './importText'
import { slicePreview } from './slicePreview'

/** Typed before a replace import can even be confirmed. */
export const REPLACE_WORD = 'DEĞİŞTİR'

const MODE_OPTIONS = [
  { value: 'merge', label: 'Birleştir' },
  { value: 'replace', label: 'Değiştir' },
] as const

const MODE_HINT: Record<ImportMode, string> = {
  merge: 'Hiçbir şey silinmez; aynı kayıtta yeni olan kalır.',
  replace: 'Mevcut kayıtların yedektekiyle değişir. Fotoğraflar silinmez.',
}

interface StagedPreview extends ImportPreview {
  /** The mode this preview was computed for; a stale one can't be applied. */
  mode: ImportMode
  /** The live state the preview was diffed against. */
  local: PersistedState
}

export interface RestoreCardProps {
  busy: BackupBusy
  onBusy: (busy: BackupBusy) => void
  /** A backup is staged — the screen hands the primary action to this card. */
  onStagedChange: (staged: boolean) => void
  /** A failed apply may already have written a rollback point; re-read it. */
  onRestorePointsChanged: () => Promise<void>
}

/** Geri yükle: choose → validate → preview per slice → mode → confirm → apply → reload. */
export function RestoreCard({ busy, onBusy, onStagedChange, onRestorePointsChanged }: RestoreCardProps) {
  const push = useToast((s) => s.push)
  const fileRef = useRef<HTMLInputElement>(null)
  const [decoded, setDecoded] = useState<DecodedBackup | undefined>()
  const [preview, setPreview] = useState<StagedPreview | undefined>()
  const [mode, setMode] = useState<ImportMode>('merge')
  const [replaceWord, setReplaceWord] = useState('')
  const [failure, setFailure] = useState<{ error: ImportError; dataIntact: boolean } | undefined>()
  const [confirmOpen, setConfirmOpen] = useState(false)

  // Re-run the read-only merge whenever the mode changes, so the numbers always describe
  // the button about to be pressed.
  useEffect(() => {
    if (!decoded) return
    let active = true
    const local = pickPersisted(useStore.getState())
    void previewImport(decoded, mode).then((p) => {
      if (active) setPreview({ ...p, mode, local })
    })
    return () => {
      active = false
    }
  }, [decoded, mode])

  useEffect(() => {
    onStagedChange(decoded !== undefined)
  }, [decoded, onStagedChange])

  const slices = useMemo(
    () =>
      preview && decoded
        ? slicePreview(preview.local, preview.next, decoded.state, preview.report)
        : undefined,
    [preview, decoded],
  )

  /** Drop the staged file and its preview together, so neither can outlive the other. */
  function clearStaged() {
    setDecoded(undefined)
    setPreview(undefined)
    setReplaceWord('')
    setConfirmOpen(false)
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    onBusy('read')
    setFailure(undefined)
    clearStaged()
    try {
      const result = await readBackupFile(file)
      if (result.ok) setDecoded(result.value)
      else setFailure({ error: result.error, dataIntact: true })
    } finally {
      onBusy('idle')
    }
  }

  async function handleApply() {
    if (!decoded) return
    onBusy('apply')
    setFailure(undefined)
    try {
      const outcome = await applyBackup(decoded, mode)
      if (!outcome.ok) {
        setFailure({ error: outcome.error, dataIntact: outcome.rolledBack })
        push(IMPORT_ERROR_TEXT[outcome.error.code], 'error')
        await onRestorePointsChanged()
        return
      }
      finishRestore({ added: outcome.report.added, updated: outcome.report.updated })
    } finally {
      setConfirmOpen(false)
      onBusy('idle')
    }
  }

  const ready = preview !== undefined && preview.mode === mode
  const report = ready ? preview.report : undefined
  const changeCount = report ? report.added + report.updated + report.removed : 0
  const replaceBlocked = mode === 'replace' && !confirmWordMatches(replaceWord, REPLACE_WORD)

  return (
    <Card title="Geri yükle">
      <div className="flex flex-col gap-4">
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          aria-label="Yedek dosyası"
          className="hidden"
          disabled={busy !== 'idle'}
          onChange={handleFile}
        />
        <Button
          variant="secondary"
          fullWidth
          icon={Upload}
          loading={busy === 'read'}
          disabled={busy !== 'idle'}
          onClick={() => fileRef.current?.click()}
        >
          Dosya seç
        </Button>

        {failure && <ImportErrorNote error={failure.error} dataIntact={failure.dataIntact} />}

        {decoded && (
          <div className="flex flex-col gap-4 border-t border-border pt-4">
            <div>
              <p className="text-base font-semibold">Yedek · {formatStamp(decoded.exportedAt)}</p>
              <p className="num text-sm font-medium text-text-muted">
                {decoded.counts.checklist} gün · {decoded.counts.checkIns} tartı ·{' '}
                {decoded.counts.strength} kuvvet · {decoded.counts.run} koşu · {decoded.photos.size}{' '}
                fotoğraf
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <SegmentedControl label="Geri yükleme biçimi" options={MODE_OPTIONS} value={mode} onChange={setMode} />
              <p className="text-sm text-text-muted">{MODE_HINT[mode]}</p>
            </div>

            {slices && report && (
              <div className="flex flex-col gap-2" aria-live="polite">
                <ImportPreviewTable slices={slices} showRemoved={mode === 'replace' || report.removed > 0} />
                {changeCount === 0 && (
                  <p className="text-sm text-text-muted">Yedekte yeni bir şey yok; verin zaten güncel.</p>
                )}
                {report.photoWrites.length > 0 && (
                  <p className="text-sm text-text-muted">
                    {report.photoWrites.length} fotoğraf eklenecek; mevcut fotoğrafların üzerine yazılmaz.
                  </p>
                )}
                {report.strippedPhotoRefs.length > 0 && (
                  <p className="text-sm text-text-muted">
                    {report.strippedPhotoRefs.length} fotoğrafın görseli yok; bağlantısı temizlenecek.
                  </p>
                )}
                {report.idConflicts.length > 0 && (
                  <p className="text-sm text-text-muted">
                    Çakışma: aynı kimlikli farklı kayıt. Seninki olduğu gibi kalır.
                  </p>
                )}
              </div>
            )}

            {mode === 'replace' && (
              <TextField
                label={`Onay için ${REPLACE_WORD} yaz`}
                value={replaceWord}
                onChange={setReplaceWord}
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
              />
            )}

            <p className="text-sm text-text-faint">Yazmadan önce geri alınabilir nokta kaydedilir.</p>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" disabled={busy === 'apply'} onClick={clearStaged}>
                Vazgeç
              </Button>
              <Button
                variant={mode === 'replace' ? 'danger' : 'primary'}
                disabled={busy !== 'idle' || !ready || changeCount === 0 || replaceBlocked}
                onClick={() => setConfirmOpen(true)}
              >
                Geri yükle
              </Button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen && report !== undefined}
        title={mode === 'replace' ? 'Tüm kayıtlar değişsin mi?' : 'Yedek birleştirilsin mi?'}
        message={
          report &&
          (mode === 'replace'
            ? `Kayıtların yedektekiyle değişir: ${report.added} yeni, ${report.updated} değişen, ${report.removed} silinen.`
            : `${report.added} yeni, ${report.updated} değişen kayıt eklenir. Hiçbir şey silinmez.`)
        }
        confirmLabel={mode === 'replace' ? 'Değiştir' : 'Birleştir'}
        destructive={mode === 'replace'}
        loading={busy === 'apply'}
        onConfirm={() => void handleApply()}
        onCancel={() => setConfirmOpen(false)}
      />
    </Card>
  )
}
