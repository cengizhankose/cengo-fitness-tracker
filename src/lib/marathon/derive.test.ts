import { describe, expect, it } from 'vitest'
import {
  weekForDate,
  plannedWorkoutFor,
  planPhase,
  raceCountdownDays,
  peakLongRun,
  sundayLongRunFor,
  nutritionPhaseFor,
  resolveActual,
  weekTotals,
  planTotals,
  nextWorkout,
  defaultOpenWeek,
  marathonSummary,
} from './derive'
import { marathonPlan } from './plan'
import type { RunLogEntry } from '@/types/userData'
import type { MarathonStatusRecord } from '@/types/marathon'

const NO_RUNS: RunLogEntry[] = []
const NO_STATUS: Record<string, MarathonStatusRecord> = {}

function run(overrides: Partial<RunLogEntry> = {}): RunLogEntry {
  return {
    id: overrides.id ?? 'r1',
    date: overrides.date ?? '2026-09-02',
    distanceKm: overrides.distanceKm ?? 8,
    durationMin: overrides.durationMin,
    averagePace: overrides.averagePace,
    notes: overrides.notes,
    createdAt: overrides.createdAt ?? '2026-09-02T18:00:00.000Z',
    ...overrides,
  }
}

function status(
  date: string,
  s: 'completed' | 'skipped',
  notes?: string,
): Record<string, MarathonStatusRecord> {
  return { [date]: { date, status: s, notes, updatedAt: '2026-09-02T19:00:00.000Z' } }
}

describe('weekForDate', () => {
  it('resolves the correct week from any contained date, and undefined outside the plan', () => {
    expect(weekForDate(marathonPlan, '2026-08-31')?.weekNumber).toBe(1)
    expect(weekForDate(marathonPlan, '2026-09-06')?.weekNumber).toBe(1)
    expect(weekForDate(marathonPlan, '2026-09-07')?.weekNumber).toBe(2)
    expect(weekForDate(marathonPlan, '2026-11-01')?.weekNumber).toBe(9)
    expect(weekForDate(marathonPlan, '2026-08-30')).toBeUndefined()
    expect(weekForDate(marathonPlan, '2026-11-02')).toBeUndefined()
  })
})

describe('plannedWorkoutFor', () => {
  it('finds the planned workout for a date inside the plan', () => {
    expect(plannedWorkoutFor(marathonPlan, '2026-09-02')?.workoutType).toBe('THRESHOLD')
    expect(plannedWorkoutFor(marathonPlan, '2026-08-30')).toBeUndefined()
  })
})

describe('raceCountdownDays', () => {
  it('counts down to the race, clamped at 0', () => {
    expect(raceCountdownDays(marathonPlan, '2026-08-29')).toBe(64)
    expect(raceCountdownDays(marathonPlan, '2026-10-31')).toBe(1)
    expect(raceCountdownDays(marathonPlan, '2026-11-01')).toBe(0)
    expect(raceCountdownDays(marathonPlan, '2026-11-05')).toBe(0)
  })
})

describe('planPhase / defaultOpenWeek', () => {
  it('classifies pre-plan, in-plan and post-race, and picks the right open week', () => {
    expect(planPhase(marathonPlan, '2026-08-29')).toBe('pre-plan')
    expect(defaultOpenWeek(marathonPlan, '2026-08-29')).toBe(1)

    expect(planPhase(marathonPlan, '2026-10-14')).toBe('in-plan')
    expect(defaultOpenWeek(marathonPlan, '2026-10-14')).toBe(7)

    expect(planPhase(marathonPlan, '2026-11-02')).toBe('post-race')
    expect(defaultOpenWeek(marathonPlan, '2026-11-02')).toBe(9)
  })
})

describe('peakLongRun / sundayLongRunFor', () => {
  it('finds the 30km peak long run on 2026-10-18', () => {
    const peak = peakLongRun(marathonPlan)
    expect(peak.targetDistanceKm).toBe(30)
    expect(peak.date).toBe('2026-10-18')
  })

  it('resolves the Sunday of the containing week, including race day', () => {
    expect(sundayLongRunFor(marathonPlan, '2026-10-28')?.workoutType).toBe('RACE')
  })
})

describe('nutritionPhaseFor', () => {
  it('resolves the phase boundaries, undefined before the plan starts', () => {
    expect(nutritionPhaseFor(marathonPlan, '2026-10-11')?.key).toBe('CUT')
    expect(nutritionPhaseFor(marathonPlan, '2026-10-12')?.key).toBe('MAINTENANCE_TRANSITION')
    expect(nutritionPhaseFor(marathonPlan, '2026-10-18')?.key).toBe('MAINTENANCE_TRANSITION')
    expect(nutritionPhaseFor(marathonPlan, '2026-10-19')?.key).toBe('PERFORMANCE')
    expect(nutritionPhaseFor(marathonPlan, '2026-11-01')?.key).toBe('PERFORMANCE')
    expect(nutritionPhaseFor(marathonPlan, '2026-08-30')).toBeUndefined()
  })
})

describe('resolveActual — run day', () => {
  const workout = plannedWorkoutFor(marathonPlan, '2026-09-02')!

  it('no data -> pending, all-null, not an override', () => {
    const actual = resolveActual(workout, NO_RUNS, NO_STATUS)
    expect(actual.status).toBe('pending')
    expect(actual.actualDistanceKm).toBeNull()
    expect(actual.actualDurationMin).toBeNull()
    expect(actual.actualPace).toBeNull()
    expect(actual.isOverride).toBe(false)
  })

  it('one run entry -> completed with its distance/duration/derived pace', () => {
    const runs = [run({ distanceKm: 8.4, durationMin: 41 })]
    const actual = resolveActual(workout, runs, NO_STATUS)
    expect(actual.status).toBe('completed')
    expect(actual.actualDistanceKm).toBe(8.4)
    expect(actual.actualDurationMin).toBe(41)
    expect(actual.actualPace).toBe('4:53/km')
  })

  it('two entries same date -> summed distance/duration, pace recomputed from the sums', () => {
    const runs = [
      run({ id: 'a', distanceKm: 5, durationMin: 25 }),
      run({ id: 'b', distanceKm: 3, durationMin: 15 }),
    ]
    const actual = resolveActual(workout, runs, NO_STATUS)
    expect(actual.actualDistanceKm).toBe(8)
    expect(actual.actualDurationMin).toBe(40)
    expect(actual.actualPace).toBe('5:00/km')
  })

  it('one entry with averagePace but no duration -> that pace verbatim', () => {
    const runs = [run({ distanceKm: 8, durationMin: undefined, averagePace: '5:10/km' })]
    const actual = resolveActual(workout, runs, NO_STATUS)
    expect(actual.actualDurationMin).toBeNull()
    expect(actual.actualPace).toBe('5:10/km')
  })

  it('explicit skipped beats a logged run', () => {
    const runs = [run({ distanceKm: 8, durationMin: 40 })]
    const actual = resolveActual(workout, runs, status('2026-09-02', 'skipped'))
    expect(actual.status).toBe('skipped')
    expect(actual.isOverride).toBe(true)
  })

  it('explicit completed with no run -> completed, distance null', () => {
    const actual = resolveActual(workout, NO_RUNS, status('2026-09-02', 'completed'))
    expect(actual.status).toBe('completed')
    expect(actual.actualDistanceKm).toBeNull()
    expect(actual.isOverride).toBe(true)
  })

  it('override notes beat run notes', () => {
    const runs = [run({ distanceKm: 8, durationMin: 40, notes: 'run notes' })]
    const actual = resolveActual(workout, runs, status('2026-09-02', 'completed', 'override notes'))
    expect(actual.notes).toBe('override notes')
  })
})

describe('resolveActual — REST day', () => {
  const restWorkout = plannedWorkoutFor(marathonPlan, '2026-08-31')!

  it('a run logged that date leaves it pending, all-null metrics, loggedRunsOnDate 1', () => {
    const runs = [run({ date: '2026-08-31', distanceKm: 8, durationMin: 40 })]
    const actual = resolveActual(restWorkout, runs, NO_STATUS)
    expect(actual.status).toBe('pending')
    expect(actual.actualDistanceKm).toBeNull()
    expect(actual.actualDurationMin).toBeNull()
    expect(actual.actualPace).toBeNull()
    expect(actual.loggedRunsOnDate).toBe(1)
    expect(actual.isOverride).toBe(false)
  })

  it('explicit completed -> completed, still all-null metrics', () => {
    const actual = resolveActual(restWorkout, NO_RUNS, status('2026-08-31', 'completed'))
    expect(actual.status).toBe('completed')
    expect(actual.actualDistanceKm).toBeNull()
    expect(actual.isOverride).toBe(true)
  })
})

describe('weekTotals', () => {
  const week1 = marathonPlan.weeks[0]!

  it('planned 39km with no data logged', () => {
    const totals = weekTotals(week1, NO_RUNS, NO_STATUS)
    expect(totals.plannedKm).toBe(39)
    expect(totals.completedKm).toBe(0)
    expect(totals.sessionsPlanned).toBe(5)
    expect(totals.restPlanned).toBe(2)
  })

  it('a logged 16km long run -> completed 16, ~41%', () => {
    const runs = [run({ date: '2026-09-06', distanceKm: 16, durationMin: 96 })]
    const totals = weekTotals(week1, runs, NO_STATUS)
    expect(totals.completedKm).toBe(16)
    expect(totals.completionPercent).toBe(41)
  })

  it('a skipped run contributes 0 km even though logged', () => {
    const runs = [run({ date: '2026-09-06', distanceKm: 16, durationMin: 96 })]
    const totals = weekTotals(week1, runs, status('2026-09-06', 'skipped'))
    expect(totals.completedKm).toBe(0)
  })

  it('a completed REST day moves restCompleted, not sessionsCompleted, and does not move the km bar', () => {
    const totals = weekTotals(week1, NO_RUNS, status('2026-08-31', 'completed'))
    expect(totals.restCompleted).toBe(1)
    expect(totals.sessionsCompleted).toBe(0)
    expect(totals.completedKm).toBe(0)
  })

  it('over-delivery clamps completionPercent at 100 but keeps completionRatio > 1', () => {
    const runs = week1.days
      .filter((d) => d.targetDistanceKm != null)
      .map((d, i) => run({ id: `over-${i}`, date: d.date, distanceKm: (d.targetDistanceKm ?? 0) * 2, durationMin: 60 }))
    const totals = weekTotals(week1, runs, NO_STATUS)
    expect(totals.completionPercent).toBe(100)
    expect(totals.completionRatio).toBeGreaterThan(1)
  })
})

describe('planTotals', () => {
  it('planned 433.2km total, 0% with no logs', () => {
    const totals = planTotals(marathonPlan, NO_RUNS, NO_STATUS)
    expect(totals.plannedKm).toBe(433.2)
    expect(totals.completionPercent).toBe(0)
  })
})

describe('nextWorkout', () => {
  it('from pre-plan finds the first non-REST day, 2026-09-01', () => {
    expect(nextWorkout(marathonPlan, NO_RUNS, NO_STATUS, '2026-08-29')?.date).toBe('2026-09-01')
  })

  it('from a Monday REST day steps to that week Tuesday', () => {
    expect(nextWorkout(marathonPlan, NO_RUNS, NO_STATUS, '2026-09-07')?.date).toBe('2026-09-08')
  })

  it('steps over completed and skipped days', () => {
    const statusMap = {
      ...status('2026-09-01', 'completed'),
      ...status('2026-09-02', 'skipped'),
    }
    expect(nextWorkout(marathonPlan, NO_RUNS, statusMap, '2026-08-29')?.date).toBe('2026-09-03')
  })

  it('is undefined after the race', () => {
    expect(nextWorkout(marathonPlan, NO_RUNS, NO_STATUS, '2026-11-02')).toBeUndefined()
  })
})

describe('marathonSummary', () => {
  it('is null for currentWeek/week during pre-plan, but daysToRace still computes', () => {
    const summary = marathonSummary(marathonPlan, NO_RUNS, NO_STATUS, '2026-08-29')
    expect(summary.phase).toBe('pre-plan')
    expect(summary.currentWeek).toBeNull()
    expect(summary.week).toBeNull()
    expect(summary.daysToRace).toBe(64)
  })

  it('resolves the current week during in-plan', () => {
    const summary = marathonSummary(marathonPlan, NO_RUNS, NO_STATUS, '2026-10-14')
    expect(summary.phase).toBe('in-plan')
    expect(summary.currentWeek?.weekNumber).toBe(7)
    expect(summary.week).not.toBeNull()
  })

  it('reports post-race with week 9 as currentWeek', () => {
    const summary = marathonSummary(marathonPlan, NO_RUNS, NO_STATUS, '2026-11-02')
    expect(summary.phase).toBe('post-race')
  })
})
