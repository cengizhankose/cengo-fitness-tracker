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

  it('asks the client for exactly the four synced slices', async () => {
    const pull = vi.fn<SyncClient['pull']>().mockResolvedValue([])
    await pullAll(makeClient({ pull }))
    expect(pull.mock.calls.map(([slice]) => slice)).toEqual(['checklist', 'checkIns', 'strengthLog', 'runLog'])
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

  it('stores a pulled checklist record carrying legacy keys verbatim', async () => {
    const record = {
      date: '2026-08-03',
      items: { completedWorkout: true, noAlcohol: true, sleep75Plus: false, inBedByMidnight: true },
      updatedAt: '2026-08-03T20:00:00.000Z',
    }
    const pull = vi.fn(async (slice: string) => (slice === 'checklist' ? [record] : []))

    await pullAll(makeClient({ pull }))

    expect(useStore.getState().checklist['2026-08-03']).toEqual(record)
  })

  it('keeps going and still merges other slices when one slice pull fails', async () => {
    const pull = vi.fn(async (slice: string) => {
      if (slice === 'checkIns') throw new Error('boom')
      if (slice === 'runLog') {
        return [
          {
            id: 'r-remote',
            date: '2026-09-02',
            distanceKm: 10,
            createdAt: '2026-09-02T19:00:00.000Z',
            updatedAt: '2026-09-02T19:00:00.000Z',
          },
        ]
      }
      return []
    })
    const client = makeClient({ pull })

    await expect(pullAll(client)).resolves.toBeUndefined()

    expect(pull).toHaveBeenCalledTimes(SLICE_NAMES.length)
    expect(useStore.getState().runLog).toEqual([
      { id: 'r-remote', date: '2026-09-02', distanceKm: 10, createdAt: '2026-09-02T19:00:00.000Z' },
    ])
    expect(useSyncStatusStore.getState().status).toBe('online')
  })
})
