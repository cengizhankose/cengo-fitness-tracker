import { describe, expect, it } from 'vitest'
import { formatSplitDistance, garminExerciseName, groupStrengthSets } from './activityDetail'

describe('garminExerciseName', () => {
  it('turns Garmin constants into readable names', () => {
    expect(garminExerciseName('BENCH_PRESS')).toBe('Bench Press')
    expect(garminExerciseName('PULL_UP')).toBe('Pull Up')
  })
})

describe('groupStrengthSets', () => {
  it('groups consecutive sets of an exercise and formats reps × kg, dropping empty sets', () => {
    const groups = groupStrengthSets([
      { exercise: 'BENCH_PRESS', reps: 10, weightKg: 60 },
      { exercise: 'BENCH_PRESS', reps: 8, weightKg: 62.5 },
      { exercise: 'BENCH_PRESS' },
      { exercise: 'PLANK', sec: 45 },
      { reps: 12 },
    ])
    expect(groups).toEqual([
      { exercise: 'Bench Press', sets: ['60 kg × 10', '62,5 kg × 8'] },
      { exercise: 'Plank', sets: ['45 sn'] },
      { exercise: undefined, sets: ['12 tekrar'] },
    ])
  })
})

describe('formatSplitDistance', () => {
  it('uses metres under a kilometre and km from there', () => {
    expect(formatSplitDistance(850)).toBe('850 m')
    expect(formatSplitDistance(1000)).toBe('1 km')
    expect(formatSplitDistance(1609.3)).toBe('1,61 km')
  })
})
