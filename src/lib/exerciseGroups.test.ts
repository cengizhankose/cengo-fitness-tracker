import { describe, expect, it } from 'vitest'
import { plan } from '@/lib/plan'
import {
  EXERCISE_REGION,
  OTHER_REGION,
  REGIONS,
  filterGroups,
  groupExercises,
} from '@/lib/exerciseGroups'

const catalog = [
  ...new Set(
    plan.weeklySchedule.flatMap((d) =>
      d.type === 'strength' ? d.exercises.map((e) => e.name) : [],
    ),
  ),
]

describe('groupExercises', () => {
  it('places every plan exercise in exactly one region, with none left over', () => {
    const groups = groupExercises(catalog)
    const placed = groups.flatMap((g) => g.exercises)

    expect([...placed].sort()).toEqual([...catalog].sort())
    expect(new Set(placed).size).toBe(placed.length)
    expect(groups.map((g) => g.region)).not.toContain(OTHER_REGION)
  })

  it('maps no exercise the plan does not contain', () => {
    expect(Object.keys(EXERCISE_REGION).filter((n) => !catalog.includes(n))).toEqual([])
  })

  it('deduplicates an exercise that appears on several days', () => {
    const groups = groupExercises(['Lateral Raise', 'Cable Curl', 'Lateral Raise'])
    expect(groups).toEqual([
      { region: 'Shoulders', exercises: ['Lateral Raise'] },
      { region: 'Biceps', exercises: ['Cable Curl'] },
    ])
  })

  it('orders regions consistently and drops empty ones', () => {
    const regions = groupExercises(catalog).map((g) => g.region)
    expect(regions).toEqual(REGIONS.filter((r) => regions.includes(r)))
    expect(regions).toHaveLength(REGIONS.length)
  })

  it('collects unmapped names under Other, last', () => {
    const groups = groupExercises(['Bulgarian Split Squat', 'Leg Press'])
    expect(groups).toEqual([
      { region: 'Legs', exercises: ['Leg Press'] },
      { region: OTHER_REGION, exercises: ['Bulgarian Split Squat'] },
    ])
  })
})

describe('filterGroups', () => {
  const groups = groupExercises(catalog)

  it('matches case-insensitively across regions and drops emptied groups', () => {
    expect(filterGroups(groups, 'CURL')).toEqual([
      { region: 'Biceps', exercises: ['Cable Curl', 'Hammer Curl'] },
      { region: 'Legs', exercises: ['Leg Curl'] },
    ])
  })

  it('matches on any part of the name, not just the start', () => {
    expect(filterGroups(groups, 'press').flatMap((g) => g.exercises)).toContain(
      'Incline Dumbbell Press',
    )
  })

  it('returns everything for a blank query and nothing for a miss', () => {
    expect(filterGroups(groups, '   ')).toEqual(groups)
    expect(filterGroups(groups, 'zzz')).toEqual([])
  })
})
