import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  Download,
  History,
  Loader2,
  ShieldAlert,
  Undo2,
  Upload,
} from 'lucide-react'
import { ScreenHeader } from '@/components/ScreenHeader'
import { SectionCard } from '@/components/SectionCard'
import { buildBackup, saveBackup } from '@/lib/backup/export'
import { IMPORT_RESULT_KEY, formatBytes } from '@/lib/backup/format'
import type { DecodedBackup, ImportError } from '@/lib/backup/format'
import {
  applySnapshot,
  applyBackup,
  previewImport,
  readBackupFile,
  readSnapshot,
  readUndoSnapshot,
} from '@/lib/backup/import'
import type { ImportPreview, RollbackSnapshot } from '@/lib/backup/import'
import type { ImportMode } from '@/lib/backup/merge'
import { useToast } from '@/store/toast'

const REPLACE_WORD = 'REPLACE'
const ROLLBACK_WORD = 'ROLL BACK'

const primaryButton =
  'flex w-full items-center justify-center gap-2 rounded-md bg-volt py-3 font-semibold text-on-accent active:bg-volt-dim disabled:opacity-40'
const secondaryButton =
  'flex w-full items-center justify-center gap-2 rounded-md border border-border-strong bg-surface-2 py-3 font-semibold text-text active:bg-surface-3 disabled:opacity-40'
const dangerButton =
  'flex w-full items-center justify-center gap-2 rounded-md bg-heat py-3 font-semibold text-text active:bg-heat-dim disabled:opacity-40'
const textInput =
  'mt-1 w-full rounded-md border border-border bg-surface-2 px-3 py-3 text-text focus:border-volt focus:outline-none'

function stamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function recordCount(snapshot: RollbackSnapshot): number {
  const s = snapshot.state
  return (
    Object.keys(s.checklist).length +
    Object.keys(s.checkIns).length +
    s.strengthLog.length +
    s.runLog.length +
    (s.benchmark ? 1 : 0)
  )
}

function ErrorNote({ error }: { error: ImportError }) {
  return (
    <div className="mt-3 rounded-md border border-heat/50 bg-heat/10 p-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-text">
        <AlertTriangle size={16} className="shrink-0 text-heat" />
        {error.message}
      </p>
      {error.issues && error.issues.length > 0 && (
        <ul className="mt-2 space-y-1">
          {error.issues.map((issue) => (
            <li key={issue.path} className="text-xs text-text-muted">
              <code className="text-text-faint">{issue.path}</code>: expected {issue.expected}, got{' '}
              {issue.got}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-text-faint">Nothing was changed.</p>
    </div>
  )
}

export function SettingsScreen() {
  const push = useToast((s) => s.push)
  const [busy, setBusy] = useState<'idle' | 'export' | 'read' | 'apply' | 'restore'>('idle')
  const [decoded, setDecoded] = useState<DecodedBackup | undefined>()
  const [preview, setPreview] = useState<ImportPreview | undefined>()
  const [mode, setMode] = useState<ImportMode>('merge')
  const [includeSettings, setIncludeSettings] = useState(false)
  const [replaceConfirm, setReplaceConfirm] = useState('')
  const [error, setError] = useState<ImportError | undefined>()
  const [snapshot, setSnapshot] = useState<RollbackSnapshot | undefined>()
  const [undoSnapshot, setUndoSnapshot] = useState<RollbackSnapshot | undefined>()
  const [rollbackArmed, setRollbackArmed] = useState(false)
  const [rollbackConfirm, setRollbackConfirm] = useState('')

  const loadSnapshots = useCallback(async () => {
    const [rollback, undo] = await Promise.all([readSnapshot(), readUndoSnapshot()])
    setSnapshot(rollback)
    setUndoSnapshot(undo)
  }, [])

  useEffect(() => {
    let active = true
    void (async () => {
      const [rollback, undo] = await Promise.all([readSnapshot(), readUndoSnapshot()])
      if (!active) return
      setSnapshot(rollback)
      setUndoSnapshot(undo)
    })()
    return () => {
      active = false
    }
  }, [])

  // Re-run the (read-only) merge whenever the user changes the mode, so the
  // preview numbers always describe the button they're about to press.
  useEffect(() => {
    if (!decoded) return
    let active = true
    void previewImport(decoded, mode, includeSettings).then((p) => {
      if (active) setPreview(p)
    })
    return () => {
      active = false
    }
  }, [decoded, mode, includeSettings])

  /** Drop the staged file and its preview together, so neither can outlive the other. */
  function clearStaged() {
    setDecoded(undefined)
    setPreview(undefined)
    setReplaceConfirm('')
  }

  function disarmRollback() {
    setRollbackArmed(false)
    setRollbackConfirm('')
  }

  async function handleExport() {
    setBusy('export')
    try {
      const built = await buildBackup()
      await saveBackup(built)
      push(`Backup ready · ${built.photoCount} photos · ${formatBytes(built.bytes)}`, 'success')
      if (built.unsupportedPhotoKeys.length > 0) {
        push(
          `${built.unsupportedPhotoKeys.length} photos use a format this app can't re-import`,
          'error',
        )
      }
    } catch {
      push("Couldn't build the backup", 'error')
    } finally {
      setBusy('idle')
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy('read')
    setError(undefined)
    clearStaged()
    try {
      const result = await readBackupFile(file)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setDecoded(result.value)
    } finally {
      setBusy('idle')
    }
  }

  async function handleImport() {
    if (!decoded) return
    setBusy('apply')
    setError(undefined)
    try {
      const outcome = await applyBackup(decoded, mode, includeSettings)
      if (!outcome.ok) {
        setError(outcome.error)
        push(outcome.error.message, 'error')
        await loadSnapshots()
        return
      }
      // Full reload: React state seeded at mount (LogScreen's weight field) and the
      // object URLs held by usePhotoUrl are both stale after a restore.
      sessionStorage.setItem(
        IMPORT_RESULT_KEY,
        JSON.stringify({ added: outcome.report.added, updated: outcome.report.updated }),
      )
      window.location.assign('/')
    } finally {
      setBusy('idle')
    }
  }

  async function applyRestorePoint(target: RollbackSnapshot) {
    setBusy('restore')
    setError(undefined)
    try {
      const outcome = await applySnapshot(target)
      if (!outcome.ok) {
        setError(outcome.error)
        push(outcome.error.message, 'error')
        await loadSnapshots()
        return
      }
      sessionStorage.setItem(IMPORT_RESULT_KEY, JSON.stringify({ added: 0, updated: 0 }))
      window.location.assign('/')
    } finally {
      setBusy('idle')
    }
  }

  const replaceBlocked = mode === 'replace' && replaceConfirm.trim() !== REPLACE_WORD
  const rollbackBlocked = rollbackConfirm.trim().toUpperCase() !== ROLLBACK_WORD

  return (
    <>
      <ScreenHeader title="Settings" subtitle="Data & backup" />
      <div className="space-y-4 px-4 py-4">
        <SectionCard title="Back up" icon={Download} accent="var(--color-volt)">
          <div className="mb-3 flex gap-2 rounded-md border border-active/40 bg-active/10 p-3">
            <ShieldAlert size={18} className="mt-0.5 shrink-0 text-active" />
            <p className="text-xs leading-relaxed text-text-muted">
              <span className="font-semibold text-text">
                This file contains your personal health data.
              </span>{' '}
              Weight, measurements, training history and every progress photo are stored inside it
              unencrypted. The file stays on your device — nothing is uploaded anywhere. Be careful
              when putting it on cloud or sharing services.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={busy !== 'idle'}
            className={primaryButton}
          >
            {busy === 'export' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Download backup
          </button>
        </SectionCard>

        <SectionCard title="Restore from backup" icon={Upload}>
          <label className={`${secondaryButton} cursor-pointer`}>
            {busy === 'read' ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            Choose backup file
            <input
              type="file"
              accept="application/json,.json"
              onChange={handleFile}
              disabled={busy !== 'idle'}
              className="hidden"
            />
          </label>

          {error && <ErrorNote error={error} />}

          {decoded && preview && (
            <div className="mt-4 space-y-3 border-t border-border pt-4">
              <div>
                <p className="text-sm font-semibold text-text">
                  Backup · {stamp(decoded.exportedAt)}
                </p>
                <p className="text-xs text-text-muted">
                  {decoded.counts.checklist} days · {decoded.counts.checkIns} check-ins ·{' '}
                  {decoded.counts.strength} strength · {decoded.counts.run} runs ·{' '}
                  {decoded.photos.size} photos
                </p>
              </div>

              <fieldset className="space-y-2">
                <label className="flex items-start gap-2.5 rounded-md border border-border bg-surface-2 p-3">
                  <input
                    type="radio"
                    name="import-mode"
                    checked={mode === 'merge'}
                    onChange={() => setMode('merge')}
                    className="mt-1 accent-volt"
                  />
                  <span className="text-sm">
                    <span className="font-semibold text-text">Merge (recommended)</span>
                    <span className="block text-xs text-text-muted">
                      Nothing is deleted; the newer record wins on conflicts.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2.5 rounded-md border border-border bg-surface-2 p-3">
                  <input
                    type="radio"
                    name="import-mode"
                    checked={mode === 'replace'}
                    onChange={() => setMode('replace')}
                    className="mt-1 accent-heat"
                  />
                  <span className="text-sm">
                    <span className="font-semibold text-text">Replace everything</span>
                    <span className="block text-xs text-text-muted">
                      Your current entries are swapped for the backup's. Photos are never deleted.
                    </span>
                  </span>
                </label>
              </fieldset>

              <p className="tnum text-sm text-text-muted">
                <span className="font-semibold text-volt">+{preview.report.added}</span> new ·{' '}
                <span className="font-semibold text-active">{preview.report.updated}</span> changed ·{' '}
                <span className="font-semibold text-heat">{preview.report.removed}</span> removed
              </p>
              {preview.report.photoWrites.length > 0 && (
                <p className="text-xs text-text-faint">
                  {preview.report.photoWrites.length} photos will be added alongside your existing
                  ones — none are overwritten.
                </p>
              )}
              {preview.report.strippedPhotoRefs.length > 0 && (
                <p className="text-xs text-text-faint">
                  {preview.report.strippedPhotoRefs.length} photo references have no image and will
                  be cleared.
                </p>
              )}
              {preview.report.idConflicts.length > 0 && (
                <p className="text-xs text-text-faint">
                  {preview.report.idConflicts.length} entries share an id with yours and were kept
                  as-is.
                </p>
              )}

              {mode === 'merge' && (
                <label className="flex items-center gap-2.5 text-sm text-text-muted">
                  <input
                    type="checkbox"
                    checked={includeSettings}
                    onChange={(e) => setIncludeSettings(e.target.checked)}
                    className="accent-volt"
                  />
                  Also take the program start date ({decoded.state.settings.programStartDate})
                </label>
              )}

              {mode === 'replace' && (
                <div>
                  <label
                    htmlFor="replace-confirm"
                    className="text-xs font-medium uppercase tracking-wide text-text-muted"
                  >
                    Type {REPLACE_WORD} to confirm
                  </label>
                  <input
                    id="replace-confirm"
                    type="text"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    value={replaceConfirm}
                    onChange={(e) => setReplaceConfirm(e.target.value)}
                    className={textInput}
                  />
                </div>
              )}

              <p className="text-xs text-text-faint">
                A rollback point is created before anything is written.
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={clearStaged}
                  disabled={busy === 'apply'}
                  className={secondaryButton}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={busy !== 'idle' || replaceBlocked}
                  className={primaryButton}
                >
                  {busy === 'apply' && <Loader2 size={16} className="animate-spin" />}
                  Import
                </button>
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Rollback point" icon={History}>
          {snapshot ? (
            <>
              <p className="text-sm text-text">Saved {stamp(snapshot.createdAt)}</p>
              <p className="mb-3 text-xs text-text-muted">
                {Object.keys(snapshot.state.checkIns).length} check-ins · {recordCount(snapshot)}{' '}
                records total
              </p>

              {!rollbackArmed ? (
                <button
                  type="button"
                  onClick={() => setRollbackArmed(true)}
                  disabled={busy !== 'idle'}
                  className={secondaryButton}
                >
                  <History size={16} />
                  Roll back to this point
                </button>
              ) : (
                <div className="space-y-3 rounded-md border border-heat/50 bg-heat/10 p-3">
                  <p className="flex items-start gap-2 text-sm text-text">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0 text-heat" />
                    <span>
                      <span className="font-semibold">This discards recent work.</span> Everything
                      you have logged since {stamp(snapshot.createdAt)} — check-ins, workouts, runs
                      and photos added after that — will be lost. A safety copy of your current data
                      is saved first, so you can undo this straight away.
                    </span>
                  </p>
                  <div>
                    <label
                      htmlFor="rollback-confirm"
                      className="text-xs font-medium uppercase tracking-wide text-text-muted"
                    >
                      Type {ROLLBACK_WORD} to confirm
                    </label>
                    <input
                      id="rollback-confirm"
                      type="text"
                      autoCapitalize="characters"
                      autoCorrect="off"
                      value={rollbackConfirm}
                      onChange={(e) => setRollbackConfirm(e.target.value)}
                      className={textInput}
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={disarmRollback}
                      disabled={busy === 'restore'}
                      className={secondaryButton}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => applyRestorePoint(snapshot)}
                      disabled={busy !== 'idle' || rollbackBlocked}
                      className={dangerButton}
                    >
                      {busy === 'restore' && <Loader2 size={16} className="animate-spin" />}
                      Roll back
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-text-faint">
              Created automatically the first time you import a backup.
            </p>
          )}

          {undoSnapshot && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 text-xs text-text-muted">
                Safety copy from {stamp(undoSnapshot.createdAt)}, taken just before the last
                rollback.
              </p>
              <button
                type="button"
                onClick={() => applyRestorePoint(undoSnapshot)}
                disabled={busy !== 'idle'}
                className={secondaryButton}
              >
                <Undo2 size={16} />
                Undo the last rollback
              </button>
            </div>
          )}
        </SectionCard>
      </div>
    </>
  )
}
