import { describe, expect, it } from 'vitest'
import { runKmPerWeek, strengthDaysPerWeek, weekOverview, workoutStreak } from '@/lib/week'
import type { Activity } from '@/types/activities'
import type { DailyChecklistRecord, RunLogEntry, StrengthLogEntry } from '@/types/userData'

function activity(over: Partial<Activity> & Pick<Activity, 'id' | 'date'>): Activity {
  return {
    garminId: 1,
    type: 'running',
    sportGroup: 'run',
    name: 'Koşu',
    startTimeLocal: `${over.date}T07:00:00`,
    durationMin: 30,
    createdAt: `${over.date}T08:00:00`,
    updatedAt: `${over.date}T08:00:00`,
    ...over,
  }
}

function lift(id: string, date: string, kind?: 'warmup' | 'working'): StrengthLogEntry {
  return { id, date, exerciseName: 'Deadlift', sets: [{ weightKg: 120, reps: 5, kind }], createdAt: `${date}T06:00:00` }
}

function ticked(date: string, items: DailyChecklistRecord['items']): DailyChecklistRecord {
  return { date, items, updatedAt: `${date}T20:00:00` }
}

const strengthLog = [
  lift('mon-1', '2026-11-16'),
  lift('mon-2', '2026-11-16'),
  lift('tue', '2026-11-17', 'warmup'), // warmup-only: not a strength day
  lift('thu', '2026-11-19', 'working'),
  lift('prev-week', '2026-11-13'),
]
const runLog: RunLogEntry[] = [
  { id: 'garmin-1', date: '2026-11-19', distanceKm: 4, averagePace: '38:36', createdAt: '2026-11-19T08:00:00' },
  { id: 'manual', date: '2026-11-21', distanceKm: 5, createdAt: '2026-11-21T09:00:00' },
]
const activities = [
  activity({ id: 'garmin-1', date: '2026-11-19', distanceKm: 4 }),
  activity({ id: 'garmin-2', date: '2026-11-22', type: 'open_water_swimming', sportGroup: 'swim', distanceKm: 1.5 }),
  activity({ id: 'garmin-3', date: '2026-11-15', distanceKm: 42.66 }), // previous week
]
const checklist = {
  '2026-11-16': ticked('2026-11-16', { completedWorkout: true }),
}

describe('weekOverview', () => {
  const week = weekOverview('2026-11-19', { strengthLog, runLog, activities, checklist })

  it('covers Monday–Sunday of the date with the planned blocks', () => {
    expect(week.weekStart).toBe('2026-11-16')
    expect(week.weekEnd).toBe('2026-11-22')
    expect(week.days.map((d) => d.dayName)).toEqual([
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
    ])
    expect(week.days[3]!.blocks.map((b) => b.type)).toEqual(['strength', 'run'])
    expect(week.planWeek).toBe(1)
    expect(week.longRunTargetKm).toBe(8)
  })

  it('counts strength days with a working set against the 5 planned', () => {
    expect(week.strengthDays).toEqual({ done: 2, planned: 5 })
    expect(week.days.map((d) => d.strengthDone)).toEqual([true, false, false, true, false, false, false])
  })

  it('sums run km without double counting the garmin- runLog mirror', () => {
    expect(week.runKm).toBe(9)
    expect(week.days[3]!.runDone).toBe(true)
    expect(week.days[5]!.runDone).toBe(true)
    expect(week.days[6]).toMatchObject({ runDone: false, otherActivityDone: true })
  })

  it('reports only the three checklist keys', () => {
    expect(week.days[0]!.checklist).toEqual({
      completedWorkout: true,
      hitProteinTarget: false,
      inBedByMidnight: false,
    })
  })
})

describe('weekly series', () => {
  it('strengthDaysPerWeek counts distinct dates with a working set', () => {
    expect(strengthDaysPerWeek(strengthLog)).toEqual([
      { weekStart: '2026-11-09', value: 1 },
      { weekStart: '2026-11-16', value: 2 },
    ])
  })

  it('runKmPerWeek adds Garmin runs and manual runs, ignoring garmin- mirrors and non-runs', () => {
    expect(runKmPerWeek(runLog, activities)).toEqual([
      { weekStart: '2026-11-09', value: 42.7 },
      { weekStart: '2026-11-16', value: 9 },
    ])
  })
})

describe('workoutStreak', () => {
  const days = (...dates: string[]) =>
    Object.fromEntries(dates.map((d) => [d, ticked(d, { completedWorkout: true })]))

  it('counts back from today, or from yesterday when today is not ticked yet', () => {
    const log = days('2026-11-16', '2026-11-17', '2026-11-18')
    expect(workoutStreak(log, '2026-11-18')).toEqual({ current: 3, best: 3 })
    expect(workoutStreak(log, '2026-11-19')).toEqual({ current: 3, best: 3 })
    expect(workoutStreak(log, '2026-11-20')).toEqual({ current: 0, best: 3 })
  })

  it('tracks the best run separately from the current one', () => {
    const log = days('2026-11-02', '2026-11-03', '2026-11-04', '2026-11-17')
    expect(workoutStreak(log, '2026-11-17')).toEqual({ current: 1, best: 3 })
  })

  it('ignores records whose workout tick is off', () => {
    const log = { '2026-11-17': ticked('2026-11-17', { completedWorkout: false, hitProteinTarget: true }) }
    expect(workoutStreak(log, '2026-11-17')).toEqual({ current: 0, best: 0 })
  })
})
