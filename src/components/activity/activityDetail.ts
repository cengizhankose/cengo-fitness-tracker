import { formatNumber, kg } from '@/lib/format'
import type { Activity, GarminStrengthSet } from '@/types/activities'

/** Garmin's "BENCH_PRESS" → "Bench Press". */
export function garminExerciseName(raw: string): string {
  return raw
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ')
}

/** One Garmin set: "60 kg × 10", "10 tekrar", "60 kg", "45 sn"; undefined when it has nothing. */
export function formatGarminSet(set: GarminStrengthSet): string | undefined {
  if (set.reps != null && set.weightKg != null) return `${kg(set.weightKg)} × ${set.reps}`
  if (set.reps != null) return `${set.reps} tekrar`
  if (set.weightKg != null) return kg(set.weightKg)
  if (set.sec != null) return `${Math.round(set.sec)} sn`
  return undefined
}

/** Consecutive sets of one exercise, as shown in the activity detail. */
export interface StrengthSetGroup {
  /** Readable name; absent when the watch did not classify the sets. */
  exercise?: string
  sets: string[]
}

/** Groups consecutive sets of the same exercise, in workout order, dropping empty sets. */
export function groupStrengthSets(sets: readonly GarminStrengthSet[]): StrengthSetGroup[] {
  const groups: { raw?: string; group: StrengthSetGroup }[] = []
  for (const set of sets) {
    const text = formatGarminSet(set)
    if (!text) continue
    const last = groups.at(-1)
    if (last && last.raw === set.exercise) {
      last.group.sets.push(text)
    } else {
      groups.push({
        raw: set.exercise,
        group: { exercise: set.exercise ? garminExerciseName(set.exercise) : undefined, sets: [text] },
      })
    }
  }
  return groups.map((g) => g.group)
}

/** Lap distance: "850 m" under a kilometre, "1 km" / "1,61 km" from there. */
export function formatSplitDistance(meters: number): string {
  return meters < 1000 ? `${formatNumber(meters, 0)} m` : `${formatNumber(meters / 1000, 2)} km`
}

/** True when the activity carries any synced detail the card does not show in its summary row. */
export function hasActivityDetail(activity: Activity): boolean {
  return (
    activity.trainingLoad != null ||
    (activity.splits?.length ?? 0) > 0 ||
    (activity.hrZones?.length ?? 0) > 0 ||
    (activity.strengthSets?.length ?? 0) > 0
  )
}
