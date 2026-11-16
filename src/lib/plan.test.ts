import { describe, expect, it } from 'vitest'
import {
  PLANNED_STRENGTH_DAYS_PER_WEEK,
  PLAN_START_DATE,
  blocksForDate,
  blocksForDay,
  canonicalExerciseName,
  defaultSessionForDate,
  findPlanExercise,
  longRunTargetKm,
  plan,
  planExerciseNames,
  planWeekNumber,
  sessionById,
  sessionExercises,
} from '@/lib/plan'
import { REGIONS } from '@/lib/exerciseGroups'
import { DAY_NAMES } from '@/lib/dates'

describe('plan integrity', () => {
  it('is version 2.0 starting on Monday 2026-11-16', () => {
    expect(plan.version).toBe('2.0')
    expect(PLAN_START_DATE).toBe('2026-11-16')
  })

  it('has a Monday-first template of 7 days', () => {
    expect(plan.weeklyTemplate.map((d) => d.day)).toEqual(DAY_NAMES)
  })

  it('references only existing sessions from weekly blocks', () => {
    for (const day of plan.weeklyTemplate) {
      for (const block of day.blocks) {
        if (block.type === 'strength') expect(sessionById(block.sessionId), `${day.day}`).toBeDefined()
      }
    }
  })

  it('gives every exercise a known region and a unit-consistent load spec', () => {
    for (const session of plan.sessions) {
      for (const ex of sessionExercises(session)) {
        expect(REGIONS, ex.name).toContain(ex.region)
        if (ex.unit === 'kg') expect(ex.stepKg, ex.name).toBeGreaterThan(0)
        else expect(ex.startKg ?? ex.stepKg, ex.name).toBeUndefined()
      }
    }
  })

  it('keeps exercise names unique per session and supersets at 2–3 exercises', () => {
    for (const session of plan.sessions) {
      const names = sessionExercises(session).map((e) => e.name)
      expect(new Set(names).size, session.id).toBe(names.length)
      for (const item of session.items) {
        if (item.kind === 'superset') {
          expect(item.exercises.length).toBeGreaterThanOrEqual(2)
          expect(item.exercises.length).toBeLessThanOrEqual(3)
        }
      }
    }
  })

  it('matches the contract sessions item for item', () => {
    const spec = (id: string) =>
      sessionById(id)!.items.map((item) =>
        (item.kind === 'single' ? [item.exercise] : item.exercises)
          .map((e) => `${e.name} ${e.sets}x${e.reps}${e.startKg ? `@${e.startKg}` : ''}`)
          .join(' + '),
      )
    expect(spec('pull')).toEqual([
      'Deadlift 1x5@120',
      'Pull Up 1xmax',
      'Seated Cable Row 1x10@50',
      'Face Pull 2x15 + Cable Curl 2x15@25',
      'Hanging Leg Raise 2x12',
    ])
    expect(spec('push')).toEqual([
      'Bench Press 1x5@80',
      'Incline Dumbbell Press 1x8@30',
      'Shoulder Press 1x8',
      'Lateral Raise 2x15@10 + Rope Pushdown 2x15@35',
      'Machine Chest Press 1x12@40',
    ])
    expect(spec('legs')).toEqual([
      'Squat 1x5@100',
      'Romanian Deadlift 1x8',
      'Leg Press 1x12',
      'Leg Curl 1x12',
      'Standing Calf Raise 2x12',
      'Plank 2x45',
    ])
    expect(spec('upper-superset')).toEqual([
      'Machine Chest Press 2x12@40 + Lat Pulldown 2x10@60',
      'Shoulder Press 2x12 + Seated Cable Row 2x10@50',
      'Lateral Raise 2x15@10 + Hammer Curl 2x15 + Overhead Triceps Extension 2x15',
    ])
    expect(spec('short')).toEqual([
      'Pull Up 3x3',
      'Push Up 2x15',
      'Face Pull 2x15',
      'Cable Curl 2x15@25 + Rope Pushdown 2x15@35',
      'Plank 2x45',
    ])
    expect(plan.sessions.map((s) => [s.id, s.title, s.durationMin])).toEqual([
      ['pull', 'Pull', 45],
      ['push', 'Push', 45],
      ['legs', 'Bacak', 45],
      ['upper-superset', 'Üst vücut superset', 25],
      ['short', 'Kısa seans', 30],
    ])
  })

  it('uses 5 kg steps for legs/deadlift and 2.5 kg for upper body', () => {
    for (const name of ['Deadlift', 'Squat', 'Romanian Deadlift', 'Leg Press']) {
      expect(findPlanExercise(name)?.stepKg, name).toBe(5)
    }
    for (const name of ['Bench Press', 'Seated Cable Row', 'Lateral Raise']) {
      expect(findPlanExercise(name)?.stepKg, name).toBe(2.5)
    }
  })

  it('has the three checklist keys and the run rule thresholds', () => {
    expect(plan.dailyChecklist).toEqual(['completedWorkout', 'hitProteinTarget', 'inBedByMidnight'])
    expect(plan.runRule).toMatchObject({ hrEasyMax: 155, hrWalkAbove: 162 })
    expect(PLANNED_STRENGTH_DAYS_PER_WEEK).toBe(5)
  })
})

describe('weekly template helpers', () => {
  it('returns the blocks of a weekday in order', () => {
    expect(blocksForDay('Thursday')).toEqual([
      { type: 'strength', sessionId: 'upper-superset' },
      { type: 'run', title: 'Kolay koşu', durationMin: 20 },
    ])
    expect(blocksForDay('Saturday').every((b) => b.optional)).toBe(true)
  })

  it('resolves blocks and the default session from a date', () => {
    expect(blocksForDate('2026-11-20').map((b) => b.type)).toEqual(['strength', 'football'])
    expect(defaultSessionForDate('2026-11-16')).toBe('pull')
    expect(defaultSessionForDate('2026-11-17')).toBe('push')
    expect(defaultSessionForDate('2026-11-18')).toBe('legs')
    expect(defaultSessionForDate('2026-11-19')).toBe('upper-superset')
    expect(defaultSessionForDate('2026-11-20')).toBe('short')
    expect(defaultSessionForDate('2026-11-21')).toBeUndefined() // optional only
    expect(defaultSessionForDate('2026-11-22')).toBeUndefined()
  })
})

describe('planWeekNumber / longRunTargetKm', () => {
  it('counts 1-based weeks from the start; earlier dates are week 1', () => {
    expect(planWeekNumber('2026-11-01')).toBe(1)
    expect(planWeekNumber('2026-11-16')).toBe(1)
    expect(planWeekNumber('2026-11-22')).toBe(1)
    expect(planWeekNumber('2026-11-23')).toBe(2)
    expect(planWeekNumber('2027-01-10')).toBe(8)
  })

  it('follows 8, 10, 10, 12 km then holds 12–14 km', () => {
    expect(longRunTargetKm('2026-11-22')).toBe(8)
    expect(longRunTargetKm('2026-11-29')).toBe(10)
    expect(longRunTargetKm('2026-12-06')).toBe(10)
    expect(longRunTargetKm('2026-12-13')).toBe(12)
    expect(longRunTargetKm('2026-12-20')).toEqual({ min: 12, max: 14 })
    expect(longRunTargetKm('2027-03-07')).toEqual({ min: 12, max: 14 })
  })
})

describe('exercise names', () => {
  it('maps the logged alias to its canonical name and leaves others alone', () => {
    expect(canonicalExerciseName('Pull Up / Lat Pulldown')).toBe('Lat Pulldown')
    expect(canonicalExerciseName('Bench Press')).toBe('Bench Press')
  })

  it('finds the first plan occurrence, also via the alias', () => {
    expect(findPlanExercise('Pull Up')).toMatchObject({ reps: 'max', unit: 'bodyweight' })
    expect(findPlanExercise('Machine Chest Press')).toMatchObject({ sets: 1, reps: 12, startKg: 40 })
    expect(findPlanExercise('Pull Up / Lat Pulldown')?.name).toBe('Lat Pulldown')
    expect(findPlanExercise('Weighted Chin Up')).toBeUndefined()
  })

  it('lists unique names in plan order', () => {
    const names = planExerciseNames()
    expect(new Set(names).size).toBe(names.length)
    expect(names.slice(0, 3)).toEqual(['Deadlift', 'Pull Up', 'Seated Cable Row'])
    expect(names).toHaveLength(22)
  })
})
