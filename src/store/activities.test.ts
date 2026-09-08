import { describe, it, expect, beforeEach } from 'vitest'
import { useActivitiesStore } from './activities'
import type { Activity } from '@/types/activities'

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
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
    ...overrides,
  }
}

describe('useActivitiesStore', () => {
  beforeEach(() => {
    useActivitiesStore.setState({ activities: {} })
  })

  it('starts empty', () => {
    expect(useActivitiesStore.getState().activities).toEqual({})
  })

  it('upsertMany inserts new activities keyed by id', () => {
    const a = makeActivity()
    const b = makeActivity({ id: 'garmin-2', garminId: 2, name: 'Evening Swim', sportGroup: 'swim' })
    useActivitiesStore.getState().upsertMany([a, b])

    const { activities } = useActivitiesStore.getState()
    expect(Object.keys(activities)).toHaveLength(2)
    expect(activities['garmin-1']).toEqual(a)
    expect(activities['garmin-2']).toEqual(b)
  })

  it('upsertMany replaces an existing id rather than duplicating it', () => {
    useActivitiesStore.getState().upsertMany([makeActivity({ name: 'Morning Run' })])
    useActivitiesStore.getState().upsertMany([
      makeActivity({ name: 'Morning Run (commented)', comment: 'Nice easy pace', updatedAt: '2026-09-07T09:00:00.000Z' }),
    ])

    const { activities } = useActivitiesStore.getState()
    expect(Object.keys(activities)).toHaveLength(1)
    expect(activities['garmin-1']?.comment).toBe('Nice easy pace')
  })

  it('upsertMany with an empty array is a no-op', () => {
    useActivitiesStore.getState().upsertMany([makeActivity()])
    const before = useActivitiesStore.getState().activities
    useActivitiesStore.getState().upsertMany([])
    expect(useActivitiesStore.getState().activities).toBe(before)
  })

  it('resetAll clears every activity', () => {
    useActivitiesStore.getState().upsertMany([makeActivity()])
    useActivitiesStore.getState().resetAll()
    expect(useActivitiesStore.getState().activities).toEqual({})
  })
})
