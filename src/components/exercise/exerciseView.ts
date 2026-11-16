// Display helpers shared by the exercise list and detail screens. Data shaping lives in
// lib/exerciseStats; this file only turns those results into short Turkish strings.

import { DAY_LABEL_TR, formatDayMonth } from '@/lib/dates'
import { EASY_RPE } from '@/lib/exerciseStats'
import type { ExerciseDay, ExerciseSummary, NextTarget } from '@/lib/exerciseStats'
import { formatNumber, formatSet, formatSetsReps, kg } from '@/lib/format'
import { canonicalExerciseName, plan, sessionExercises } from '@/lib/plan'
import type { DayName, ExerciseUnit, PlanExercise, Session } from '@/types/plan'
import type { StrengthSet } from '@/types/userData'

/** "80 kg × 5 · RPE 9" — a set with its effort when recorded. */
export function formatSetWithEffort(set: StrengthSet, unit: ExerciseUnit): string {
  const text = formatSet(set, unit)
  return set.rpe != null ? `${text} · RPE ${formatNumber(set.rpe)}` : text
}

/**
 * A set split for a big Stat number: 42,5 + "kg × 12" · 8 + "tekrar · +10 kg" · 45 + "sn".
 * Keeps the large numerals short enough for a half-width cell at 390 px.
 */
export function setStatParts(set: StrengthSet, unit: ExerciseUnit): { value: number; unit: string } {
  switch (unit) {
    case 'kg':
      return { value: set.weightKg, unit: `kg × ${set.reps}` }
    case 'bodyweight':
      return { value: set.reps, unit: set.weightKg > 0 ? `tekrar · +${kg(set.weightKg)}` : 'tekrar' }
    case 'seconds':
      return { value: set.reps, unit: 'sn' }
  }
}

/** "80 kg × 5 · RPE 9 · 16 Kas", or "Henüz kayıt yok" without a training day. */
export function lastTopSetLine(summary: ExerciseSummary): string {
  const top = summary.last?.topSet
  if (!summary.last || !top) return 'Henüz kayıt yok'
  return `${formatSetWithEffort(top, summary.unit)} · ${formatDayMonth(summary.last.date)}`
}

/** What the progress charts and sparklines plot for a unit. */
export interface Metric {
  /** Chart title. */
  title: string
  /** Series name in the tooltip. */
  series: string
  /** Unit suffix. */
  unit: string
}

/** Top-set load for kg exercises; reps (seconds) for bodyweight (timed) exercises. */
export function metricFor(unit: ExerciseUnit): Metric {
  switch (unit) {
    case 'kg':
      return { title: 'Ağırlık', series: 'En ağır set', unit: 'kg' }
    case 'bodyweight':
      return { title: 'Tekrar', series: 'En iyi set', unit: 'tekrar' }
    case 'seconds':
      return { title: 'Süre', series: 'En uzun set', unit: 'sn' }
  }
}

/** The plotted value of a day's top set (see metricFor); undefined for warmup-only days. */
export function dayMetric(day: ExerciseDay): number | undefined {
  const top = day.topSet
  if (!top) return undefined
  return day.unit === 'kg' ? top.weightKg : top.reps
}

/** Training days (with a top set) oldest first — the x axis of every progress view. */
export function trainingDaysOldestFirst(summary: ExerciseSummary): ExerciseDay[] {
  return summary.history.filter((d) => d.topSet).reverse()
}

/** "880 kg", "24 tekrar" or "90 sn", matching how lib/exerciseStats sums the day. */
export function formatVolume(day: ExerciseDay): string {
  if (day.unit === 'seconds') return `${formatNumber(day.volume)} sn`
  if (day.workingSets.some((s) => s.weightKg > 0)) return kg(day.volume)
  return `${formatNumber(day.volume)} tekrar`
}

/** One session of the plan that contains an exercise, with the weekdays it is scheduled on. */
export interface PlanPlacement {
  session: Session
  exercise: PlanExercise
  days: { day: DayName; optional: boolean }[]
}

/** Every plan session containing the exercise (aliases resolved), in plan order. */
export function planPlacements(name: string): PlanPlacement[] {
  const canonical = canonicalExerciseName(name)
  return plan.sessions.flatMap((session) => {
    const exercise = sessionExercises(session).find((e) => e.name === canonical)
    if (!exercise) return []
    const days = plan.weeklyTemplate.flatMap((d) =>
      d.blocks
        .filter((b) => b.type === 'strength' && b.sessionId === session.id)
        .map((b) => ({ day: d.day, optional: b.optional === true })),
    )
    return [{ session, exercise, days }]
  })
}

/** "Push · Salı", "Üst vücut superset · Perşembe, Cumartesi (isteğe bağlı)". */
export function placementLabel({ session, days }: PlanPlacement): string {
  if (days.length === 0) return session.title
  const when = days
    .map((d) => (d.optional ? `${DAY_LABEL_TR[d.day]} (isteğe bağlı)` : DAY_LABEL_TR[d.day]))
    .join(', ')
  return `${session.title} · ${when}`
}

/** "1 × 5" from the plan prescription; "12 tekrar" for exercises outside the plan. */
export function targetPrescription(target: NextTarget, planExercise: PlanExercise | undefined): string {
  const reps = target.reps ?? planExercise?.reps
  if (target.sets != null && reps != null) return formatSetsReps(target.sets, reps, target.unit)
  if (target.reps == null) return '—'
  return target.unit === 'seconds' ? `${target.reps} sn` : `${target.reps} tekrar`
}

/** "80 kg", "+10 kg", "Vücut ağırlığı", "Sen seç"; undefined for timed exercises. */
export function targetLoad(target: NextTarget): string | undefined {
  switch (target.unit) {
    case 'seconds':
      return undefined
    case 'bodyweight':
      return target.weightKg != null && target.weightKg > 0 ? `+${kg(target.weightKg)}` : 'Vücut ağırlığı'
    case 'kg':
      return target.weightKg != null ? kg(target.weightKg) : 'Sen seç'
  }
}

/** One short sentence explaining the target: first time, hold, or raise it. */
export function targetHint(target: NextTarget): string {
  switch (target.hint) {
    case 'first':
      if (target.unit === 'kg') {
        return target.weightKg != null
          ? `İlk kez: ${kg(target.weightKg)} ile başla.`
          : 'İlk kez: rahat bir ağırlıkla başla.'
      }
      return target.unit === 'seconds' ? 'İlk kez: hedef süreyi dene.' : 'İlk kez: vücut ağırlığıyla başla.'
    case 'hold':
      return `Aynı yükle devam; hedefi RPE ${EASY_RPE} veya altında yapınca artır.`
    case 'increase': {
      const by = target.increaseBy ?? 0
      if (target.unit === 'kg') return `Kolay geldi: +${kg(by)}, ${kg(target.weightKg)} dene.`
      if (target.unit === 'seconds') return `Kolay geldi: +${by} sn dene.`
      return `Kolay geldi: +${by} tekrar dene.`
    }
  }
}
