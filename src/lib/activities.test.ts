import { describe, it, expect } from 'vitest'
import {
  groupByRecency,
  formatActivityDuration,
  formatActivityDistance,
  isRunActivity,
  manualRuns,
} from './activities'
import type { RunLogEntry } from '@/types/userData'
import type { Activity } from '@/types/activities'

const TUESDAY = '2026-09-08' // same week as WEDNESDAY_TODAY below (Monday = 2026-09-07)
const WEDNESDAY_TODAY = '2026-09-09'

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'garmin-1',
    garminId: 1,
    type: 'running',
    sportGroup: 'run',
    name: 'Run',
    date: TUESDAY,
    startTimeLocal: `${TUESDAY}T07:00:00`,
    durationMin: 30,
    createdAt: `${TUESDAY}T07:30:00.000Z`,
    updatedAt: `${TUESDAY}T07:30:00.000Z`,
    ...overrides,
  }
}

describe('groupByRecency', () => {
  it('puts an activity dated today in the today bucket', () => {
    const a = makeActivity({ id: 'a', date: WEDNESDAY_TODAY, startTimeLocal: `${WEDNESDAY_TODAY}T07:00:00` })
    const groups = groupByRecency([a], WEDNESDAY_TODAY)
    expect(groups.today).toEqual([a])
    expect(groups.thisWeek).toEqual([])
    expect(groups.older).toEqual([])
  })

  it('puts an earlier-this-week activity (not today) in thisWeek', () => {
    const a = makeActivity({ id: 'a', date: TUESDAY })
    const groups = groupByRecency([a], WEDNESDAY_TODAY)
    expect(groups.thisWeek).toEqual([a])
  })

  it('puts an activity from a previous week in older', () => {
    const a = makeActivity({ id: 'a', date: '2026-08-20', startTimeLocal: '2026-08-20T07:00:00' })
    const groups = groupByRecency([a], WEDNESDAY_TODAY)
    expect(groups.older).toEqual([a])
  })

  it('sorts each bucket newest-first by startTimeLocal', () => {
    const early = makeActivity({ id: 'early', startTimeLocal: `${TUESDAY}T06:00:00` })
    const late = makeActivity({ id: 'late', startTimeLocal: `${TUESDAY}T18:00:00` })
    const groups = groupByRecency([early, late], WEDNESDAY_TODAY)
    expect(groups.thisWeek.map((a) => a.id)).toEqual(['late', 'early'])
  })
})

describe('formatActivityDuration', () => {
  it('formats under an hour as "N dk"', () => {
    expect(formatActivityDuration(32)).toBe('32 dk')
  })

  it('formats an hour or more as "H sa M dk"', () => {
    expect(formatActivityDuration(72)).toBe('1 sa 12 dk')
  })

  it('rounds fractional minutes', () => {
    expect(formatActivityDuration(32.6)).toBe('33 dk')
  })
})

describe('formatActivityDistance', () => {
  it('formats to at most 2 decimals with a decimal comma', () => {
    expect(formatActivityDistance(6.4)).toBe('6,4 km')
    expect(formatActivityDistance(0.752)).toBe('0,75 km')
    expect(formatActivityDistance(42.66)).toBe('42,66 km')
  })
})

describe('isRunActivity', () => {
  it('accepts every running-type activity and nothing else', () => {
    expect(isRunActivity(makeActivity({ type: 'treadmill_running' }))).toBe(true)
    expect(isRunActivity(makeActivity({ type: 'track_running' }))).toBe(true)
    expect(isRunActivity(makeActivity({ type: 'walking', sportGroup: 'other' }))).toBe(false)
    expect(isRunActivity(makeActivity({ type: 'open_water_swimming', sportGroup: 'swim' }))).toBe(false)
  })
})

describe('manualRuns', () => {
  it('drops runLog entries mirrored from Garmin', () => {
    const runs: RunLogEntry[] = [
      { id: 'garmin-24207602358', date: '2026-09-02', distanceKm: 1.8, averagePace: '38:36', createdAt: 'x' },
      { id: '862cbbd6-4499-48f7-b903-d61a1b34913a', date: '2026-09-15', distanceKm: 6, createdAt: 'x' },
    ]
    expect(manualRuns(runs).map((r) => r.id)).toEqual(['862cbbd6-4499-48f7-b903-d61a1b34913a'])
  })
})
