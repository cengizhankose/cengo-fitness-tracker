import { describe, it, expect, vi, beforeEach } from 'vitest'
import { activityFromWire } from './adapters'
import {
  pullActivities,
  getActivitiesCursor,
  setActivitiesCursor,
  type ActivitiesClient,
} from './activities'
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

function makeClient(overrides: Partial<ActivitiesClient> = {}): ActivitiesClient {
  return {
    pull: vi.fn().mockResolvedValue([]),
    ...overrides,
  }
}

describe('pullActivities', () => {
  beforeEach(() => {
    localStorage.clear()
    useActivitiesStore.setState({ activities: {} })
  })

  it('is a no-op when sync is disabled (no client)', async () => {
    await expect(pullActivities(undefined)).resolves.toBeUndefined()
    expect(useActivitiesStore.getState().activities).toEqual({})
  })

  it('never throws when the pull fails, and leaves local state untouched', async () => {
    const client = makeClient({ pull: vi.fn().mockRejectedValue(new Error('offline')) })
    await expect(pullActivities(client)).resolves.toBeUndefined()
    expect(useActivitiesStore.getState().activities).toEqual({})
    expect(getActivitiesCursor()).toBeUndefined()
  })

  it('merges pulled records into the activities store, null-stripped', async () => {
    const client = makeClient({
      pull: vi.fn().mockResolvedValue([{ ...WIRE_BASE, distanceKm: null }]),
    })
    await pullActivities(client)

    const stored = useActivitiesStore.getState().activities['garmin-1']
    expect(stored).not.toHaveProperty('distanceKm')
    expect(stored?.name).toBe('Morning Run')
  })

  it('advances the cursor to the newest updatedAt pulled, and passes it as updatedSince next time', async () => {
    const pull = vi.fn().mockResolvedValue([{ ...WIRE_BASE, updatedAt: '2026-09-07T07:30:00.000Z' }])
    await pullActivities(makeClient({ pull }))
    expect(getActivitiesCursor()).toBe('2026-09-07T07:30:00.000Z')

    await pullActivities(makeClient({ pull }))
    expect(pull).toHaveBeenLastCalledWith('2026-09-07T07:30:00.000Z')
  })

  it('does not move the cursor backward and does not clear it on an empty pull', async () => {
    setActivitiesCursor('2026-09-07T07:30:00.000Z')
    await pullActivities(makeClient({ pull: vi.fn().mockResolvedValue([]) }))
    expect(getActivitiesCursor()).toBe('2026-09-07T07:30:00.000Z')
  })
})
