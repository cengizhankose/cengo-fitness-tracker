import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '@/store'
import { plan } from '@/lib/plan'
import { weeklyCompletion, workoutStreak, workoutsPerWeek } from '@/lib/derive'
import type { IsoDate } from '@/types/userData'

const MON: IsoDate = '2026-01-05'
const TUE: IsoDate = '2026-01-06'
const WED: IsoDate = '2026-01-07'
const state = () => useStore.getState()
const logStrength = (date: IsoDate) =>
  state().addStrengthEntry({ date, exerciseName: 'Squat', sets: [{ weightKg: 100, reps: 5 }] })

beforeEach(() => state().resetAll())

describe('metrics stay consistent after a log is deleted', () => {
  it('shrinks the streak when the last day loses its only log', () => {
    logStrength(MON)
    logStrength(TUE)
    const wedId = logStrength(WED)
    expect(workoutStreak(state().checklist, WED)).toEqual({ current: 3, best: 3 })
    state().removeStrengthEntry(wedId)
    expect(workoutStreak(state().checklist, WED)).toEqual({ current: 2, best: 2 })
  })

  it('drops the weekly completion count by one', () => {
    logStrength(MON)
    logStrength(TUE)
    const tueId = state().strengthLog[0]!.id
    expect(weeklyCompletion(plan, state().checklist, WED).done).toBe(2)
    state().removeStrengthEntry(tueId)
    expect(weeklyCompletion(plan, state().checklist, WED).done).toBe(1)
  })

  it('decrements and removes the workouts-per-week bucket', () => {
    logStrength(MON)
    logStrength(TUE)
    expect(workoutsPerWeek(state().checklist)).toEqual([{ weekStart: MON, value: 2 }])
    state().removeStrengthEntry(state().strengthLog[0]!.id)
    expect(workoutsPerWeek(state().checklist)).toEqual([{ weekStart: MON, value: 1 }])
    state().removeStrengthEntry(state().strengthLog[0]!.id)
    expect(workoutsPerWeek(state().checklist)).toEqual([])
  })

  it('keeps metrics when another log still covers the day', () => {
    logStrength(MON)
    const secondId = logStrength(MON)
    state().removeStrengthEntry(secondId)
    expect(workoutStreak(state().checklist, MON).current).toBe(1)
    expect(weeklyCompletion(plan, state().checklist, MON).done).toBe(1)
  })

  it('keeps a manually ticked day counted after its log is deleted', () => {
    state().toggleChecklistItem(MON, 'completedWorkout')
    const id = logStrength(MON)
    state().removeStrengthEntry(id)
    expect(weeklyCompletion(plan, state().checklist, MON).done).toBe(1)
    expect(workoutStreak(state().checklist, MON).current).toBe(1)
  })
})
