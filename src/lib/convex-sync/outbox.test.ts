import { describe, it, expect, vi, afterEach } from 'vitest'
import { useStore } from '@/store'
import { useSyncStatusStore } from './status'
import { startOutbox, INITIAL_BACKOFF_MS } from './outbox'
import type { SyncClient } from './client'
import type { SyncedSlices } from './types'
import { populatedState } from '@/test/fixtures'

function makeClient(overrides: { push?: ReturnType<typeof vi.fn<SyncClient['push']>> } = {}) {
  return {
    pull: vi.fn<SyncClient['pull']>().mockResolvedValue([]),
    push: overrides.push ?? vi.fn<SyncClient['push']>().mockResolvedValue(undefined),
    syncStateCursor: vi.fn<SyncClient['syncStateCursor']>().mockResolvedValue(undefined),
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('startOutbox', () => {
  it('debounces rapid changes into a single batched push', async () => {
    vi.useFakeTimers()
    const client = makeClient()
    const handle = startOutbox(client, () => useStore.getState(), useStore.subscribe, {
      debounceMs: 200,
    })

    useStore.getState().setChecklistItem('2026-08-03', 'completedWorkout', true)
    await vi.advanceTimersByTimeAsync(50)
    useStore.getState().setChecklistItem('2026-08-03', 'hitProteinTarget', true)
    await vi.advanceTimersByTimeAsync(150) // 200ms since 1st change, but only 150 since 2nd
    expect(client.push).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(50) // now 200ms since the 2nd (debounce-resetting) change
    expect(client.push).toHaveBeenCalledTimes(1)
    expect(client.push).toHaveBeenCalledWith('checklist', expect.any(Array))
    const [, records] = client.push.mock.calls[0] as [string, Array<{ date: string }>]
    expect(records).toHaveLength(1)
    expect(records[0]?.date).toBe('2026-08-03')

    handle.stop()
  })

  it('only pushes slices with pending records', async () => {
    vi.useFakeTimers()
    const client = makeClient()
    const handle = startOutbox(client, () => useStore.getState(), useStore.subscribe, {
      debounceMs: 10,
    })

    useStore.getState().setChecklistItem('2026-08-03', 'completedWorkout', true)
    await vi.advanceTimersByTimeAsync(10)

    expect(client.push).toHaveBeenCalledTimes(1)
    expect(client.push).toHaveBeenCalledWith('checklist', expect.any(Array))

    handle.stop()
  })

  it('pushes exactly the four synced slices, never the retired benchmark / marathonStatus', async () => {
    const client = makeClient()
    const state = {
      ...populatedState(),
      benchmark: { date: '2026-08-04', timeSec: 1500, createdAt: '2026-08-04T06:30:00.000Z' },
      marathonStatus: {
        '2026-09-02': { date: '2026-09-02', status: 'completed', updatedAt: '2026-09-02T19:00:00.000Z' },
      },
    } as unknown as SyncedSlices
    const handle = startOutbox(client, () => state, () => () => {})

    await handle.flushNow()

    const pushed = client.push.mock.calls.map(([slice]) => slice)
    expect(pushed).toEqual(['checklist', 'checkIns', 'strengthLog', 'runLog'])
    const counts = Object.fromEntries(client.push.mock.calls.map(([slice, records]) => [slice, records.length]))
    expect(counts).toEqual({ checklist: 2, checkIns: 2, strengthLog: 2, runLog: 1 })

    handle.stop()
  })

  it('does not re-push a record that was already pushed', async () => {
    vi.useFakeTimers()
    const client = makeClient()
    const handle = startOutbox(client, () => useStore.getState(), useStore.subscribe, {
      debounceMs: 10,
    })

    useStore.getState().setChecklistItem('2026-08-03', 'completedWorkout', true)
    await vi.advanceTimersByTimeAsync(10)
    expect(client.push).toHaveBeenCalledTimes(1)

    useStore.getState().setChecklistItem('2026-08-04', 'completedWorkout', true)
    await vi.advanceTimersByTimeAsync(10)
    expect(client.push).toHaveBeenCalledTimes(2)
    const [, records] = client.push.mock.calls[1] as [string, Array<{ date: string }>]
    expect(records).toHaveLength(1)
    expect(records[0]?.date).toBe('2026-08-04')

    handle.stop()
  })

  it('never throws on a failed push, marks status offline, and retries with backoff until it succeeds', async () => {
    vi.useFakeTimers()
    const push = vi
      .fn<SyncClient['push']>()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValue(undefined)
    const client = makeClient({ push })
    const handle = startOutbox(client, () => useStore.getState(), useStore.subscribe, {
      debounceMs: 10,
    })

    expect(() => useStore.getState().setChecklistItem('2026-08-03', 'completedWorkout', true)).not.toThrow()
    await vi.advanceTimersByTimeAsync(10)

    expect(push).toHaveBeenCalledTimes(1)
    expect(useSyncStatusStore.getState().status).toBe('offline')

    await vi.advanceTimersByTimeAsync(INITIAL_BACKOFF_MS)
    expect(push).toHaveBeenCalledTimes(2)
    expect(useSyncStatusStore.getState().status).toBe('online')

    handle.stop()
  })

  it('stop() unsubscribes and cancels pending timers', async () => {
    vi.useFakeTimers()
    const client = makeClient()
    const handle = startOutbox(client, () => useStore.getState(), useStore.subscribe, {
      debounceMs: 10,
    })
    handle.stop()

    useStore.getState().setChecklistItem('2026-08-03', 'completedWorkout', true)
    await vi.advanceTimersByTimeAsync(1000)
    expect(client.push).not.toHaveBeenCalled()
  })
})
