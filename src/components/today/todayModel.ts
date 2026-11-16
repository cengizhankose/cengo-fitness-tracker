// Small view-model helpers for the Bugün screen: target labels, the run line and the active
// session's exercise progress. Data shaping itself lives in the pure libs (plan, exerciseStats,
// week, weight); these only turn their results into what the cards display.

import { addDays } from '@/lib/dates'
import { formatSet, kg } from '@/lib/format'
import { longRunTargetKm, plan, sessionById, sessionExercises } from '@/lib/plan'
import { sessionEntries, setKind } from '@/lib/exerciseStats'
import type { NextTarget } from '@/lib/exerciseStats'
import { describeBlock } from '@/components/plan/blockText'
import type { Activity } from '@/types/activities'
import type { RunBlock } from '@/types/plan'
import type { ActiveSession, IsoDate, StrengthLogEntry } from '@/types/userData'

/** Today's target as "80 kg × 5" / "+5 kg × 8" / "max tekrar" / "45 sn"; "—" for an unknown load. */
export function formatTarget(target: NextTarget): string {
  const { unit, weightKg, reps } = target
  if (unit === 'seconds') return reps == null ? '— sn' : `${reps} sn`
  if (unit === 'bodyweight') {
    if (reps == null) return (weightKg ?? 0) > 0 ? `+${kg(weightKg)} × max` : 'max tekrar'
    return formatSet({ weightKg: weightKg ?? 0, reps }, 'bodyweight')
  }
  if (weightKg == null || reps == null) return `${kg(weightKg)} × ${reps ?? 'max'}`
  return formatSet({ weightKg, reps }, 'kg')
}

/** Suggested raise as a short badge text ("+2,5 kg", "+1 tekrar", "+5 sn"). */
export function formatIncrease(target: NextTarget): string | undefined {
  if (target.hint !== 'increase' || target.increaseBy == null) return undefined
  if (target.unit === 'kg') return `+${kg(target.increaseBy)}`
  return target.unit === 'seconds' ? `+${target.increaseBy} sn` : `+${target.increaseBy} tekrar`
}

/** The HR rule every run follows, from the plan's numbers. */
export const RUN_HR_RULE = `Nabız ${plan.runRule.hrEasyMax} altı; ${plan.runRule.hrWalkAbove}'yi geçerse yürü`

/** What a run block asks for on `date`: this week's long-run distance ("8 km", "12–14 km") or its duration. */
export function runTargetLabel(block: RunBlock, date: IsoDate): string | undefined {
  return describeBlock(block, longRunTargetKm(date)).detail
}

/** Exercises of the running session with all target working sets logged, out of all listed. */
export function activeSessionProgress(
  active: ActiveSession,
  strengthLog: readonly StrengthLogEntry[],
): { done: number; total: number } {
  const session = sessionById(active.planSessionId)
  const targetSets = new Map(session ? sessionExercises(session).map((ex) => [ex.name, ex.sets]) : [])
  const done = active.exerciseNames.filter((name) => {
    const working = sessionEntries(strengthLog, active.id, name)
      .flatMap((e) => e.sets)
      .filter((s) => setKind(s) === 'working').length
    return working >= (targetSets.get(name) ?? 1)
  }).length
  return { done, total: active.exerciseNames.length }
}

/** Days (today included) a Garmin activity still counts as recent on Bugün. */
const RECENT_DAYS = 3

/** Newest Garmin activity of today and the two days before, if any. */
export function recentActivity(activities: readonly Activity[], today: IsoDate): Activity | undefined {
  const from = addDays(today, -(RECENT_DAYS - 1))
  let newest: Activity | undefined
  for (const a of activities) {
    if (a.date < from || a.date > today) continue
    if (!newest || a.startTimeLocal > newest.startTimeLocal) newest = a
  }
  return newest
}
