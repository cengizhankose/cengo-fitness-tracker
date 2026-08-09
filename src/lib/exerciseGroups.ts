// Body-region grouping for the strength catalog. The plan JSON carries no muscle
// metadata, so the mapping lives here — keyed by the exact exercise names used in
// src/data/plan.json (same convention as exerciseImages.ts).

export const REGIONS = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Core'] as const
export type Region = (typeof REGIONS)[number]

/** Bucket for anything not in the map — a preset from the query string, or a future plan entry. */
export const OTHER_REGION = 'Other'

export const EXERCISE_REGION: Record<string, Region> = {
  'Incline Dumbbell Press': 'Chest',
  'Machine Chest Press': 'Chest',
  'Weighted Dip / Chest Press': 'Chest',
  'Pull Up / Lat Pulldown': 'Back',
  'Seated Cable Row': 'Back',
  'Weighted Chin Up': 'Back',
  'Row Variation': 'Back',
  'Lateral Raise': 'Shoulders',
  'Shoulder Press': 'Shoulders',
  'Cable Curl': 'Biceps',
  'Hammer Curl': 'Biceps',
  'Rope Pushdown': 'Triceps',
  'Overhead Triceps Extension': 'Triceps',
  'Leg Press': 'Legs',
  'Romanian Deadlift': 'Legs',
  'Leg Curl': 'Legs',
  'Standing Calf Raise': 'Legs',
  'Hanging Leg Raise': 'Core',
}

export interface ExerciseGroup {
  region: Region | typeof OTHER_REGION
  exercises: string[]
}

/**
 * Bucket names by region, deduplicated (an exercise repeated across days appears
 * once) and in a stable order: regions as listed, names in catalog order.
 * Empty regions are dropped; `Other` is appended only when something is unmapped.
 */
export function groupExercises(names: string[]): ExerciseGroup[] {
  const buckets = new Map<string, string[]>()
  for (const name of new Set(names)) {
    const region = EXERCISE_REGION[name] ?? OTHER_REGION
    const bucket = buckets.get(region)
    if (bucket) bucket.push(name)
    else buckets.set(region, [name])
  }
  const order: ExerciseGroup['region'][] = [...REGIONS, OTHER_REGION]
  return order
    .map((region) => ({ region, exercises: buckets.get(region) ?? [] }))
    .filter((group) => group.exercises.length > 0)
}

/** Case-insensitive substring match across every group; groups left empty are dropped. */
export function filterGroups(groups: ExerciseGroup[], query: string): ExerciseGroup[] {
  const q = query.trim().toLowerCase()
  if (!q) return groups
  return groups
    .map((group) => ({
      ...group,
      exercises: group.exercises.filter((name) => name.toLowerCase().includes(q)),
    }))
    .filter((group) => group.exercises.length > 0)
}
