import { describe, it, expect, vi } from 'vitest'
import { useStore, pickPersisted } from '@/store'
import { useSyncStatusStore } from './status'
import { pullAll } from './pull'
import type { SyncClient } from './client'
import { SLICE_NAMES } from './types'

function makeClient(overrides: Partial<SyncClient> = {}): SyncClient {
  return {
    pull: vi.fn().mockResolvedValue([]),
    push: vi.fn().mockResolvedValue(undefined),
    syncStateCursor: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('pullAll', () => {
  it('is a no-op when sync is disabled (no client)', async () => {
    const before = pickPersisted(useStore.getState())
    await expect(pullAll(undefined)).resolves.toBeUndefined()
    expect(pickPersisted(useStore.getState())).toEqual(before)
  })

  it('never throws when every slice pull fails, and leaves local state untouched', async () => {
    const before = pickPersisted(useStore.getState())
    const client = makeClient({ pull: vi.fn().mockRejectedValue(new Error('offline')) })

    await expect(pullAll(client)).resolves.toBeUndefined()

    expect(pickPersisted(useStore.getState())).toEqual(before)
    expect(useSyncStatusStore.getState().status).toBe('offline')
    expect(client.pull).toHaveBeenCalledTimes(SLICE_NAMES.length)
  })

  it('merges records pulled successfully into the store', async () => {
    const pull = vi.fn(async (slice: string) => {
      if (slice === 'checklist') {
        return [
          {
            date: '2026-08-03',
            items: { completedWorkout: true },
            updatedAt: '2026-08-03T20:00:00.000Z',
          },
        ]
      }
      return []
    })
    const client = makeClient({ pull })

    await pullAll(client)

    expect(useStore.getState().checklist['2026-08-03']?.items.completedWorkout).toBe(true)
    expect(useSyncStatusStore.getState().status).toBe('online')
  })

  it('keeps going and still merges other slices when one slice pull fails', async () => {
    const pull = vi.fn(async (slice: string) => {
      if (slice === 'checkIns') throw new Error('boom')
      if (slice === 'marathonStatus') {
        return [
          { date: '2026-09-02', status: 'completed', updatedAt: '2026-09-02T19:00:00.000Z' },
        ]
      }
      return []
    })
    const client = makeClient({ pull })

    await expect(pullAll(client)).resolves.toBeUndefined()

    expect(useStore.getState().marathonStatus['2026-09-02']?.status).toBe('completed')
  })
})
