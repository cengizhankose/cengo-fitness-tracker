import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGarminDailyStore } from '@/store/garminDaily'
import { garminDailyFromWire, pullGarminDaily, type GarminDailyClient } from './garminDaily'

const WIRE = {
  date: '2026-11-20',
  steps: 8432,
  sleepMin: 432,
  updatedAt: '2026-11-20T08:00:00.000Z',
}

function makeClient(pullAll: GarminDailyClient['pullAll']): GarminDailyClient {
  return { pullAll }
}

describe('garminDailyFromWire', () => {
  it('collapses a null field to absent and keeps real values, zero included', () => {
    const day = garminDailyFromWire({ ...WIRE, hrvStatus: null, sleepScore: null, awakeMin: 0 })
    expect(day).not.toHaveProperty('hrvStatus')
    expect(day).not.toHaveProperty('sleepScore')
    expect(day.awakeMin).toBe(0)
    expect(day.steps).toBe(8432)
  })
})

describe('pullGarminDaily', () => {
  beforeEach(() => {
    useGarminDailyStore.getState().resetAll()
  })

  it('is a no-op when sync is disabled (no client)', async () => {
    await expect(pullGarminDaily(undefined)).resolves.toBeUndefined()
    expect(useGarminDailyStore.getState().days).toEqual({})
  })

  it('upserts pulled rows by date, null-stripped, keeping days the pull did not touch', async () => {
    useGarminDailyStore.getState().upsertMany([
      { date: '2026-11-19', steps: 5000, updatedAt: '2026-11-19T08:00:00.000Z' },
      { date: '2026-11-20', steps: 100, hrvStatus: 'LOW', updatedAt: '2026-11-20T06:00:00.000Z' },
    ])

    await pullGarminDaily(makeClient(vi.fn().mockResolvedValue([{ ...WIRE, hrvStatus: null }])))

    const { days } = useGarminDailyStore.getState()
    expect(days['2026-11-20']).toEqual(WIRE)
    expect(days['2026-11-19']?.steps).toBe(5000)
  })

  it('never throws when the pull fails, and leaves the store untouched', async () => {
    useGarminDailyStore.getState().upsertMany([garminDailyFromWire(WIRE)])
    const before = useGarminDailyStore.getState().days

    await expect(
      pullGarminDaily(makeClient(vi.fn().mockRejectedValue(new Error('offline')))),
    ).resolves.toBeUndefined()
    expect(useGarminDailyStore.getState().days).toBe(before)
  })
})
