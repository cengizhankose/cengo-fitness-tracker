import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { del, entries, get, set } from 'idb-keyval'
import { STORAGE_KEY, pickPersisted, useStore } from '@/store'
import { SNAPSHOT_KEY, UNDO_KEY, readBackupFile } from '@/lib/backup/import'
import type { RollbackSnapshot } from '@/lib/backup/import'
import { finishRestore } from '@/components/settings/finishRestore'
import {
  EMPTY_STATE,
  backupDoc,
  fakePhoto,
  legacyBackupDoc,
  makeState,
  populatedState,
  resetStore,
  seedPhoto,
  toFile,
} from '@/test/fixtures'
import type { StrengthLogEntry } from '@/types/userData'
import { SettingsScreen } from './SettingsScreen'

// The real handoff reloads the page; keep the test in this document and record the summary.
vi.mock('@/components/settings/finishRestore', () => ({ finishRestore: vi.fn() }))

const FRONT = 'photo:2026-11-16:front'
const SIDE = 'photo:2026-11-16:side'

/** A local entry the backup doesn't have, so replace and rollback have something to remove. */
const LOCAL_ONLY: StrengthLogEntry = {
  id: 'local-1',
  date: '2026-11-17',
  exerciseName: 'Bench Press',
  sets: [{ weightKg: 80, reps: 5, rpe: 8 }],
  createdAt: '2026-11-17T07:00:00.000Z',
}

async function renderScreen() {
  const user = userEvent.setup()
  const view = render(
    <MemoryRouter>
      <SettingsScreen />
    </MemoryRouter>,
  )
  // The rollback card resolves an IndexedDB read on mount; wait for it to settle.
  await waitFor(() =>
    expect(
      screen.queryByText(/otomatik kaydedilir/i) ??
        screen.queryByRole('button', { name: 'Bu noktaya dön' }),
    ).toBeInTheDocument(),
  )
  return { user, ...view }
}

function fileInput(): HTMLInputElement {
  return screen.getByLabelText('Yedek dosyası') as HTMLInputElement
}

function applyButton(): HTMLElement {
  return screen.getByRole('button', { name: 'Geri yükle' })
}

function totalsRow(): HTMLElement {
  return screen.getByRole('row', { name: /toplam/i })
}

beforeEach(() => {
  vi.mocked(finishRestore).mockClear()
})

describe('SettingsScreen · export', () => {
  const originalCreate = URL.createObjectURL

  afterEach(() => {
    URL.createObjectURL = originalCreate
    // `revokeObjectURL` stays stubbed: saveBackup revokes on a 10 s timer that outlives the test.
    vi.restoreAllMocks()
  })

  it('downloads a valid backup with the photos, which restores through the same screen', async () => {
    const state = populatedState()
    resetStore(state)
    await seedPhoto(FRONT, fakePhoto(1))
    await seedPhoto(SIDE, fakePhoto(2))

    const saved: Blob[] = []
    URL.createObjectURL = vi.fn((blob: Blob) => {
      saved.push(blob)
      return 'blob:backup'
    })
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const { user } = await renderScreen()
    await user.click(screen.getByRole('button', { name: 'Yedeği indir' }))
    await waitFor(() => expect(saved).toHaveLength(1))

    const file = new File([saved[0]], 'cengo-cut-backup.json', { type: 'application/json' })
    const read = await readBackupFile(file)
    expect(read.ok).toBe(true)
    if (!read.ok) return
    expect(read.value.state).toEqual(pickPersisted(useStore.getState()))
    expect([...read.value.photos.keys()].sort()).toEqual([FRONT, SIDE])

    // v3 file made by this app → wipe the phone → restore it here.
    resetStore(EMPTY_STATE)
    await del(FRONT)
    await del(SIDE)
    await user.upload(fileInput(), file)
    expect(await screen.findByRole('row', { name: /toplam/i })).toHaveTextContent('+7')

    await user.click(applyButton())
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Birleştir' }))

    await waitFor(() => expect(finishRestore).toHaveBeenCalledWith({ added: 7, updated: 0 }))
    const restored = useStore.getState()
    expect(restored.strengthLog).toEqual(state.strengthLog)
    expect(restored.runLog).toEqual(state.runLog)
    const front = restored.checkIns['2026-11-16']?.frontPhotoKey
    expect(front).toMatch(/^photo:2026-11-16:front#/)
    expect(await get(front as string)).toBeInstanceOf(Blob)
  })
})

describe('SettingsScreen · restore', () => {
  it('rejects a file that is not a backup and changes nothing', async () => {
    const local = makeState({ strengthLog: [LOCAL_ONLY] })
    resetStore(local)
    const envelope = localStorage.getItem(STORAGE_KEY)
    const { user } = await renderScreen()

    await user.upload(fileInput(), toFile(backupDoc({ magic: 'something-else' })))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Geri yükle' })).not.toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toBe(envelope)
    expect(useStore.getState().strengthLog).toEqual(local.strengthLog)
    expect(await entries()).toEqual([])
  })

  it('names the damaged field of a corrupt backup and changes nothing', async () => {
    resetStore(EMPTY_STATE)
    const envelope = localStorage.getItem(STORAGE_KEY)
    const { user } = await renderScreen()

    const doc = backupDoc()
    doc.state = { ...populatedState(), strengthLog: 'not-a-list' }
    await user.upload(fileInput(), toFile(doc))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('state.strengthLog')
    expect(screen.queryByRole('button', { name: 'Geri yükle' })).not.toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toBe(envelope)
    expect(useStore.getState().strengthLog).toEqual([])
    expect(await entries()).toEqual([])
  })

  it('previews per slice without writing, then merges and reports the counts', async () => {
    resetStore(EMPTY_STATE)
    const envelope = localStorage.getItem(STORAGE_KEY)
    const { user } = await renderScreen()

    await user.upload(fileInput(), toFile(backupDoc()))

    await screen.findByRole('row', { name: /toplam/i })
    expect(totalsRow()).toHaveTextContent('+7')
    expect(screen.getByRole('row', { name: /kuvvet kayıtları/i })).toHaveTextContent('+2')
    expect(screen.getByRole('row', { name: /koşular/i })).toHaveTextContent('+1')
    expect(screen.getByRole('row', { name: /tartı ve ölçü/i })).toHaveTextContent('+2')
    expect(screen.getByRole('row', { name: /günlük işaretler/i })).toHaveTextContent('+2')
    // Preview is read-only.
    expect(localStorage.getItem(STORAGE_KEY)).toBe(envelope)
    expect(await entries()).toEqual([])

    await user.click(applyButton())
    const dialog = screen.getByRole('dialog')
    expect(useStore.getState().strengthLog).toEqual([])
    await user.click(within(dialog).getByRole('button', { name: 'Birleştir' }))

    await waitFor(() => expect(finishRestore).toHaveBeenCalledWith({ added: 7, updated: 0 }))
    expect(useStore.getState().strengthLog.map((e) => e.id).sort()).toEqual(['s1', 's2'])
    expect(await get(SNAPSHOT_KEY)).toBeDefined()
  })

  it('discards the staged backup on cancel', async () => {
    resetStore(EMPTY_STATE)
    const { user } = await renderScreen()
    await user.upload(fileInput(), toFile(backupDoc()))
    await screen.findByRole('row', { name: /toplam/i })

    await user.click(screen.getByRole('button', { name: 'Vazgeç' }))

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Geri yükle' })).not.toBeInTheDocument(),
    )
    expect(useStore.getState().strengthLog).toEqual([])
    expect(await entries()).toEqual([])
    expect(finishRestore).not.toHaveBeenCalled()
  })

  it('gates replace behind the typed word and a destructive confirmation', async () => {
    const local = makeState({ strengthLog: [LOCAL_ONLY] })
    resetStore(local)
    const { user } = await renderScreen()
    await user.upload(fileInput(), toFile(backupDoc()))
    await screen.findByRole('row', { name: /toplam/i })

    await user.click(screen.getByRole('radio', { name: 'Değiştir' }))
    await waitFor(() => expect(screen.getByRole('row', { name: /kuvvet kayıtları/i })).toHaveTextContent('+2'))
    expect(applyButton()).toBeDisabled()

    const word = screen.getByLabelText(/onay için/i)
    await user.type(word, 'yanlış')
    expect(applyButton()).toBeDisabled()
    await user.clear(word)
    await user.type(word, 'değiştir')
    await waitFor(() => expect(applyButton()).toBeEnabled())

    // First confirmation step can still be backed out of.
    await user.click(applyButton())
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Vazgeç' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(useStore.getState().strengthLog).toEqual(local.strengthLog)
    expect(finishRestore).not.toHaveBeenCalled()

    await user.click(applyButton())
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Değiştir' }))

    await waitFor(() => expect(finishRestore).toHaveBeenCalled())
    expect(useStore.getState().strengthLog.map((e) => e.id).sort()).toEqual(['s1', 's2'])
  })

  it.each([1, 2] as const)('restores a schema-v%i backup made by the old app', async (version) => {
    resetStore(EMPTY_STATE)
    const { user } = await renderScreen()

    await user.upload(fileInput(), toFile(legacyBackupDoc(version)))
    expect(await screen.findByRole('row', { name: /toplam/i })).toHaveTextContent('+5')

    await user.click(applyButton())
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Birleştir' }))

    await waitFor(() => expect(finishRestore).toHaveBeenCalledWith({ added: 5, updated: 0 }))
    const s = useStore.getState()
    expect(s.strengthLog.map((e) => e.id)).toEqual(['legacy-s1'])
    expect(s.runLog.map((e) => e.id)).toEqual(['legacy-r1'])
    expect(Object.keys(s.checkIns)).toEqual(['2026-08-03'])
    expect(s.settings).not.toHaveProperty('programStartDate')
    expect(s).not.toHaveProperty('benchmark')
  })
})

describe('SettingsScreen · rollback point', () => {
  it('rolls back to the pre-import state behind a typed word and a confirmation, then offers undo', async () => {
    const local = makeState({ strengthLog: [LOCAL_ONLY] })
    resetStore(local)
    const envelope = localStorage.getItem(STORAGE_KEY)

    const first = await renderScreen()
    await first.user.upload(fileInput(), toFile(backupDoc()))
    await screen.findByRole('row', { name: /toplam/i })
    await first.user.click(applyButton())
    await first.user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Birleştir' }))
    await waitFor(() => expect(finishRestore).toHaveBeenCalled())
    expect(useStore.getState().strengthLog).toHaveLength(3)
    first.unmount()

    // As after the post-import reload.
    const { user } = await renderScreen()
    await user.click(screen.getByRole('button', { name: 'Bu noktaya dön' }))

    const go = screen.getByRole('button', { name: 'Geri dön' })
    expect(go).toBeDisabled()
    const word = screen.getByLabelText(/onay için/i)
    await user.type(word, 'geri')
    expect(go).toBeDisabled()
    await user.type(word, ' dön')
    await waitFor(() => expect(go).toBeEnabled())

    await user.click(go)
    // Nothing happens before the dialog is confirmed.
    expect(useStore.getState().strengthLog).toHaveLength(3)
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Geri dön' }))

    await waitFor(() => expect(finishRestore).toHaveBeenLastCalledWith({ added: 0, updated: 0 }))
    expect(useStore.getState().strengthLog).toEqual(local.strengthLog)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(envelope)
    const undo = await get<RollbackSnapshot>(UNDO_KEY)
    expect(undo?.state.strengthLog).toHaveLength(3)
  })

  it('disarms without touching anything on cancel', async () => {
    const local = makeState({ strengthLog: [LOCAL_ONLY] })
    const pre: RollbackSnapshot = {
      createdAt: '2026-11-15T13:42:11.284Z',
      reason: 'pre-import',
      envelope: null,
      state: EMPTY_STATE,
      deleteOnRestore: [],
      restorePhotos: {},
    }
    await set(SNAPSHOT_KEY, pre)
    resetStore(local)
    const envelope = localStorage.getItem(STORAGE_KEY)
    const { user } = await renderScreen()

    await user.click(screen.getByRole('button', { name: 'Bu noktaya dön' }))
    await user.type(screen.getByLabelText(/onay için/i), 'GERİ DÖN')
    await user.click(screen.getByRole('button', { name: 'Vazgeç' }))

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Geri dön' })).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Bu noktaya dön' })).toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toBe(envelope)
    expect(useStore.getState().strengthLog).toEqual(local.strengthLog)
    expect(finishRestore).not.toHaveBeenCalled()
  })
})
