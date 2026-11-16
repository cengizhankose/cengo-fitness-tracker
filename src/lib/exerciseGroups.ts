// Body-region grouping for the exercise catalog. Plan exercises carry their region in
// src/data/plan.json; names that were only ever logged (old plan) are mapped here.

import { canonicalExerciseName, findPlanExercise, planExerciseNames } from '@/lib/plan'
import type { Region } from '@/types/plan'

/** Display order of regions. */
export const REGIONS: readonly Region[] = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'legs',
  'core',
]

/** Bucket for anything unmapped (e.g. a free-text exercise). */
export const OTHER_REGION = 'other'
/** A region or the `other` bucket. */
export type RegionKey = Region | typeof OTHER_REGION

/** Turkish region labels. */
export const REGION_LABEL: Record<RegionKey, string> = {
  chest: 'Göğüs',
  back: 'Sırt',
  shoulders: 'Omuz',
  biceps: 'Biceps',
  triceps: 'Triceps',
  legs: 'Bacak',
  core: 'Karın',
  other: 'Diğer',
}

/** Old-plan exercise names that may exist in logged data but are not in the current plan. */
const LEGACY_REGION: Record<string, Region> = {
  'Weighted Dip / Chest Press': 'chest',
  'Weighted Chin Up': 'back',
  'Row Variation': 'back',
}

/** Region of every known exercise name: every plan exercise plus the old logged names. */
export const EXERCISE_REGION: Record<string, Region> = {
  ...LEGACY_REGION,
  ...Object.fromEntries(planExerciseNames().map((name) => [name, findPlanExercise(name)!.region])),
}

/** Region of an exercise (aliases resolved), `other` when unknown. */
export function regionOf(name: string): RegionKey {
  return EXERCISE_REGION[canonicalExerciseName(name)] ?? OTHER_REGION
}

/** Exercises of one region, in catalog order. */
export interface ExerciseGroup {
  region: RegionKey
  exercises: string[]
}

/**
 * Bucket names by region: aliases resolved to canonical names, deduplicated (an exercise
 * repeated across sessions appears once), regions in REGIONS order, names in input order.
 * Empty regions are dropped; `other` is appended only when something is unmapped.
 */
export function groupExercises(names: string[]): ExerciseGroup[] {
  const buckets = new Map<RegionKey, string[]>()
  for (const name of new Set(names.map(canonicalExerciseName))) {
    const region = regionOf(name)
    const bucket = buckets.get(region)
    if (bucket) bucket.push(name)
    else buckets.set(region, [name])
  }
  const order: RegionKey[] = [...REGIONS, OTHER_REGION]
  return order
    .map((region) => ({ region, exercises: buckets.get(region) ?? [] }))
    .filter((group) => group.exercises.length > 0)
}

/**
 * Case folding for English names typed on a Turkish keyboard: "İ"/"ı" both match "i".
 * (Plain tr-TR lowercasing would turn "Incline" into "ıncline".)
 */
function fold(s: string): string {
  return s.toLowerCase().replace(/ı/g, 'i').replace(/\u0307/g, '')
}

/** Case-insensitive substring match across every group; groups left empty are dropped. */
export function filterGroups(groups: ExerciseGroup[], query: string): ExerciseGroup[] {
  const q = fold(query.trim())
  if (!q) return groups
  return groups
    .map((group) => ({
      ...group,
      exercises: group.exercises.filter((name) => fold(name).includes(q)),
    }))
    .filter((group) => group.exercises.length > 0)
}
