import { describe, it, expect, vi, beforeEach } from 'vitest'
import { activityFromWire } from './adapters'
import { pullActivities, type ActivitiesClient } from './activities'
import { useActivitiesStore } from '@/store/activities'

const WIRE_BASE = {
  id: 'garmin-1',
  garminId: 1,
  type: 'running',
  sportGroup: 'run',
  name: 'Morning Run',
  date: '2026-09-07',
  startTimeLocal: '2026-09-07T07:00:00',
  durationMin: 30,
  createdAt: '2026-09-07T07:30:00.000Z',
  updatedAt: '2026-09-07T07:30:00.000Z',
}

describe('activityFromWire', () => {
  it('passes required fields through untouched', () => {
    const activity = activityFromWire(WIRE_BASE)
    expect(activity).toEqual(WIRE_BASE)
  })

  it('strips a `null` optional field down to absent (garmin-logan serializes unset as null)', () => {
    const wire = { ...WIRE_BASE, distanceKm: null, comment: null, avgHr: 152 }
    const activity = activityFromWire(wire)
    expect(activity).not.toHaveProperty('distanceKm')
    expect(activity).not.toHaveProperty('comment')
    expect(activity.avgHr).toBe(152)
  })

  it('keeps a real optional value, including zero', () => {
    const wire = { ...WIRE_BASE, avgCadence: 0, distanceKm: 6.4 }
    const activity = activityFromWire(wire)
    expect(activity.avgCadence).toBe(0)
    expect(activity.distanceKm).toBe(6.4)
  })

  it('strips a `null` hr on an individual split, keeping the rest of the split intact', () => {
    const wire = {
      ...WIRE_BASE,
      splits: [
        { i: 1, distanceM: 1000, sec: 300, hr: null },
        { i: 2, distanceM: 1000, sec: 295, hr: 155 },
      ],
    }
    const activity = activityFromWire(wire)
    expect(activity.splits?.[0]).not.toHaveProperty('hr')
    expect(activity.splits?.[0]).toEqual({ i: 1, distanceM: 1000, sec: 300 })
    expect(activity.splits?.[1]?.hr).toBe(155)
  })

  it('round-trips every optional field when present and non-null', () => {
    const wire = {
      ...WIRE_BASE,
      movingDurationMin: 29,
      distanceKm: 6.4,
      avgHr: 150,
      maxHr: 171,
      calories: 410,
      aerobicTE: 3.2,
      anaerobicTE: 0.4,
      trainingLoad: 88,
      hrZones: [{ zone: 1, min: 2 }],
      strokeSummary: undefined,
      avgCadence: 178,
      rawNotes: 'note',
      comment: 'Nice easy pace',
      commentGeneratedAt: '2026-09-07T09:00:00.000Z',
      planAdherence: 'on_plan',
      planRef: '2026-09-07-monday-easy',
    }
    expect(activityFromWire(wire)).toEqual(wire)
  })
})

function makeClient(pullAll: ActivitiesClient['pullAll'] = vi.fn().mockResolvedValue([])): ActivitiesClient {
  return { pullAll }
}

describe('pullActivities', () => {
  beforeEach(() => {
    useActivitiesStore.getState().resetAll()
  })

  it('is a no-op when sync is disabled (no client)', async () => {
    await expect(pullActivities(undefined)).resolves.toBeUndefined()
    expect(useActivitiesStore.getState().activities).toEqual({})
  })

  it('never throws when the pull fails, and leaves the store untouched', async () => {
    const existing = activityFromWire(WIRE_BASE)
    useActivitiesStore.getState().upsertMany([existing])
    const client = makeClient(vi.fn().mockRejectedValue(new Error('offline')))
    await expect(pullActivities(client)).resolves.toBeUndefined()
    expect(useActivitiesStore.getState().activities).toEqual({ 'garmin-1': existing })
  })

  it('merges pulled records into the activities store, null-stripped', async () => {
    await pullActivities(makeClient(vi.fn().mockResolvedValue([{ ...WIRE_BASE, distanceKm: null, comment: null }])))

    const stored = useActivitiesStore.getState().activities['garmin-1']
    expect(stored).not.toHaveProperty('distanceKm')
    expect(stored).not.toHaveProperty('comment')
    expect(stored?.name).toBe('Morning Run')
  })

  it('performs a full pull every time: pullAll is called with no arguments, also on the second call', async () => {
    const pullAll = vi.fn<ActivitiesClient['pullAll']>().mockResolvedValue([WIRE_BASE])
    const client = makeClient(pullAll)
    await pullActivities(client)
    await pullActivities(client)
    expect(pullAll).toHaveBeenCalledTimes(2)
    expect(pullAll.mock.calls).toEqual([[], []])
  })

  it('picks up a comment added server-side after the first pull, even with updatedAt unchanged', async () => {
    const pullAll = vi
      .fn<ActivitiesClient['pullAll']>()
      .mockResolvedValueOnce([{ ...WIRE_BASE, comment: null }])
      .mockResolvedValueOnce([
        { ...WIRE_BASE, comment: 'Nice easy pace', commentGeneratedAt: '2026-09-07T09:00:00.000Z' },
      ])
    const client = makeClient(pullAll)

    await pullActivities(client)
    expect(useActivitiesStore.getState().activities['garmin-1']).not.toHaveProperty('comment')

    await pullActivities(client)
    const stored = useActivitiesStore.getState().activities['garmin-1']
    expect(stored?.comment).toBe('Nice easy pace')
    expect(stored?.updatedAt).toBe(WIRE_BASE.updatedAt)
  })
})
