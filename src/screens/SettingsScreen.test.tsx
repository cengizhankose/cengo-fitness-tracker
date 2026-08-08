import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { entries, set } from 'idb-keyval'
import { STORAGE_KEY, useStore } from '@/store'
import { SNAPSHOT_KEY, UNDO_KEY, envelopeFor } from '@/lib/backup/import'
import type { RollbackSnapshot } from '@/lib/backup/import'
import { SettingsScreen } from './SettingsScreen'
import { backupDoc, photoEntry, populatedState, resetStore, toFile } from '@/test/fixtures'

async function renderScreen() {
  const user = userEvent.setup()
  render(<SettingsScreen />)
  // The rollback-point card resolves an IndexedDB read on mount.
  await screen.findByText(/created automatically/i)
  return user
}

function snapshotFor(reason: RollbackSnapshot['reason']): RollbackSnapshot {
  const state = populatedState()
  return {
    createdAt: '2026-08-08T13:42:11.284Z',
    reason,
    envelope: envelopeFor(state),
    state,
    deleteOnRestore: ['photo:2026-08-10:front#abc123'],
    restorePhotos: {},
  }
}

async function renderWithSnapshot() {
  const user = userEvent.setup()
  render(<SettingsScreen />)
  return { user, button: await screen.findByRole('button', { name: /roll back to this point/i }) }
}

function fileInput(): HTMLInputElement {
  const input = screen.getByLabelText(/choose backup file/i)
  return input as HTMLInputElement
}

describe('SettingsScreen', () => {
  it('shows the sensitive-data warning next to the export button', async () => {
    await renderScreen()
    expect(screen.getByText(/contains your personal health data/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /download backup/i })).toBeEnabled()
  })

  it('previews a chosen backup without writing anything', async () => {
    resetStore()
    const envelope = localStorage.getItem(STORAGE_KEY)
    const user = await renderScreen()

    await user.upload(fileInput(), toFile(backupDoc()))

    expect(await screen.findByText('+6')).toBeInTheDocument()
    expect(screen.getByText(/2 days · 1 check-ins · 1 strength · 1 runs/)).toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toBe(envelope)
    expect(await entries()).toEqual([])
  })

  it('blocks replace until the confirmation word is typed', async () => {
    resetStore()
    const user = await renderScreen()
    await user.upload(fileInput(), toFile(backupDoc()))
    await screen.findByText('+6')

    await user.click(screen.getByRole('radio', { name: /replace everything/i }))
    const importButton = screen.getByRole('button', { name: /^import$/i })
    expect(importButton).toBeDisabled()

    await user.type(screen.getByLabelText(/type replace to confirm/i), 'replace')
    expect(importButton).toBeDisabled()

    await user.clear(screen.getByLabelText(/type replace to confirm/i))
    await user.type(screen.getByLabelText(/type replace to confirm/i), 'REPLACE')
    await waitFor(() => expect(importButton).toBeEnabled())
  })

  it('reports a damaged backup and changes nothing', async () => {
    const local = populatedState()
    resetStore(local)
    localStorage.setItem(STORAGE_KEY, envelopeFor(local))
    const user = await renderScreen()

    await user.upload(fileInput(), toFile(backupDoc({ magic: 'something-else' })))

    expect(await screen.findByText(/isn't a Cengo Cut backup/i)).toBeInTheDocument()
    expect(screen.getByText(/nothing was changed/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^import$/i })).not.toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toBe(envelopeFor(local))
    expect(useStore.getState().strengthLog).toEqual(local.strengthLog)
  })

  it('warns about the photos an import will add', async () => {
    resetStore()
    const user = await renderScreen()
    await user.upload(
      fileInput(),
      toFile(
        backupDoc({
          photos: [{ ...photoEntry('photo:2026-08-03:front') }, { ...photoEntry('photo:2026-08-03:side') }],
        }),
      ),
    )
    expect(await screen.findByText(/2 photos will be added alongside/i)).toBeInTheDocument()
    expect(screen.getByText(/none are overwritten/i)).toBeInTheDocument()
  })

  it('discards the staged backup on cancel', async () => {
    resetStore()
    const user = await renderScreen()
    await user.upload(fileInput(), toFile(backupDoc()))
    await screen.findByText('+6')

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /^import$/i })).not.toBeInTheDocument(),
    )
    expect(useStore.getState().strengthLog).toEqual([])
    expect(await entries()).toEqual([])
  })
})

describe('SettingsScreen · manual rollback', () => {
  it('does not offer a rollback until one exists', async () => {
    await renderScreen()
    expect(screen.queryByRole('button', { name: /roll back/i })).not.toBeInTheDocument()
  })

  it('states what will be lost and gates the action behind a typed confirmation', async () => {
    await set(SNAPSHOT_KEY, snapshotFor('pre-import'))
    const { user, button } = await renderWithSnapshot()

    // Nothing destructive is one tap away.
    await user.click(button)
    expect(screen.getByText(/this discards recent work/i)).toBeInTheDocument()
    expect(screen.getByText(/will be lost/i)).toBeInTheDocument()
    expect(screen.getByText(/safety copy of your current data is saved first/i)).toBeInTheDocument()

    const confirmButton = screen.getByRole('button', { name: /^roll back$/i })
    expect(confirmButton).toBeDisabled()

    const field = screen.getByLabelText(/type roll back to confirm/i)
    await user.type(field, 'rollback')
    expect(confirmButton).toBeDisabled()

    await user.clear(field)
    await user.type(field, 'ROLL BACK')
    await waitFor(() => expect(confirmButton).toBeEnabled())
  })

  it('disarms without touching anything on cancel', async () => {
    await set(SNAPSHOT_KEY, snapshotFor('pre-import'))
    const local = populatedState()
    resetStore(local)
    localStorage.setItem(STORAGE_KEY, envelopeFor(local))
    const { user, button } = await renderWithSnapshot()

    await user.click(button)
    await user.type(screen.getByLabelText(/type roll back to confirm/i), 'ROLL BACK')
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /^roll back$/i })).not.toBeInTheDocument(),
    )
    expect(screen.getByRole('button', { name: /roll back to this point/i })).toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toBe(envelopeFor(local))
    expect(useStore.getState().strengthLog).toEqual(local.strengthLog)
  })

  it('offers an undo once a safety copy exists', async () => {
    await set(SNAPSHOT_KEY, snapshotFor('pre-import'))
    await set(UNDO_KEY, snapshotFor('pre-rollback'))
    await renderWithSnapshot()

    expect(
      await screen.findByRole('button', { name: /undo the last rollback/i }),
    ).toBeEnabled()
    expect(screen.getByText(/taken just before the last rollback/i)).toBeInTheDocument()
  })
})
