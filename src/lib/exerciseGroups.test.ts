import { describe, expect, it } from 'vitest'
import { planExerciseNames } from '@/lib/plan'
import {
  EXERCISE_REGION,
  OTHER_REGION,
  REGIONS,
  REGION_LABEL,
  filterGroups,
  groupExercises,
  regionOf,
} from '@/lib/exerciseGroups'

const catalog = planExerciseNames()

/** Every name ever logged under the old plan. */
const OLD_LOGGED = [
  'Cable Curl', 'Hammer Curl', 'Hanging Leg Raise', 'Incline Dumbbell Press', 'Lateral Raise',
  'Leg Curl', 'Leg Press', 'Machine Chest Press', 'Overhead Triceps Extension',
  'Pull Up / Lat Pulldown', 'Romanian Deadlift', 'Rope Pushdown', 'Row Variation',
  'Seated Cable Row', 'Shoulder Press', 'Standing Calf Raise', 'Weighted Chin Up',
  'Weighted Dip / Chest Press',
]

describe('region map', () => {
  it('covers every plan exercise and every old logged name', () => {
    for (const name of [...catalog, ...OLD_LOGGED]) expect(regionOf(name), name).not.toBe(OTHER_REGION)
    for (const name of catalog) expect(EXERCISE_REGION[name], name).toBeDefined()
  })

  it('resolves the alias before looking up the region', () => {
    expect(regionOf('Pull Up / Lat Pulldown')).toBe('back')
  })

  it('has a Turkish label for every region and for other', () => {
    expect(REGIONS.map((r) => REGION_LABEL[r])).toEqual(['Göğüs', 'Sırt', 'Omuz', 'Biceps', 'Triceps', 'Bacak', 'Karın'])
    expect(REGION_LABEL[OTHER_REGION]).toBe('Diğer')
  })
})

describe('groupExercises', () => {
  it('places every plan exercise in exactly one region, with none left over', () => {
    const placed = groupExercises(catalog).flatMap((g) => g.exercises)
    expect([...placed].sort()).toEqual([...catalog].sort())
    expect(groupExercises(catalog).map((g) => g.region)).not.toContain(OTHER_REGION)
  })

  it('deduplicates, canonicalizes aliases and keeps input order within a region', () => {
    expect(groupExercises(['Lateral Raise', 'Cable Curl', 'Lateral Raise', 'Pull Up / Lat Pulldown', 'Lat Pulldown'])).toEqual([
      { region: 'back', exercises: ['Lat Pulldown'] },
      { region: 'shoulders', exercises: ['Lateral Raise'] },
      { region: 'biceps', exercises: ['Cable Curl'] },
    ])
  })

  it('orders regions consistently and drops empty ones', () => {
    const regions = groupExercises(catalog).map((g) => g.region)
    expect(regions).toEqual(REGIONS.filter((r) => regions.includes(r)))
    expect(regions).toHaveLength(REGIONS.length)
  })

  it('collects unmapped names under other, last', () => {
    expect(groupExercises(['Bulgarian Split Squat', 'Leg Press'])).toEqual([
      { region: 'legs', exercises: ['Leg Press'] },
      { region: OTHER_REGION, exercises: ['Bulgarian Split Squat'] },
    ])
  })
})

describe('filterGroups', () => {
  const groups = groupExercises(catalog)

  it('matches case-insensitively across regions and drops emptied groups', () => {
    expect(filterGroups(groups, 'CURL')).toEqual([
      { region: 'biceps', exercises: ['Cable Curl', 'Hammer Curl'] },
      { region: 'legs', exercises: ['Leg Curl'] },
    ])
  })

  it('matches Turkish-keyboard capitals and dotless i', () => {
    expect(filterGroups(groups, 'İNCLİNE').flatMap((g) => g.exercises)).toEqual(['Incline Dumbbell Press'])
    expect(filterGroups(groups, 'ıncline').flatMap((g) => g.exercises)).toEqual(['Incline Dumbbell Press'])
  })

  it('returns everything for a blank query and nothing for a miss', () => {
    expect(filterGroups(groups, '   ')).toEqual(groups)
    expect(filterGroups(groups, 'zzz')).toEqual([])
  })
})
