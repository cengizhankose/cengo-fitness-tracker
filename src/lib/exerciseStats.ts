// Per-exercise history and stats derived from the strength log. Entries are aggregated by
// (calendar date, canonical exercise name) regardless of `sessionId`, so ad-hoc single-set
// entries and session entries of the same day read as one training day.

import { canonicalExerciseName, findPlanExercise, planExerciseNames, sessionExercises } from '@/lib/plan'
import { regionOf, type RegionKey } from '@/lib/exerciseGroups'
import type { ExerciseUnit, PlanExercise, Session } from '@/types/plan'
import type { IsoDate, StrengthLogEntry, StrengthSet } from '@/types/userData'

type Kind = NonNullable<StrengthSet['kind']>

/**
 * Warmup/working discriminator with the backwards-compatible default: entries written
 * before the session flow have no `kind`, and every one of them was a working set.
 */
export function setKind(set: StrengthSet): Kind {
  return set.kind ?? 'working'
}

/**
 * Epley estimated one-rep max, rounded to 0.1 kg. A single rep is the max itself;
 * no estimate for zero load or zero reps.
 */
export function e1rm(weightKg: number, reps: number): number | undefined {
  if (weightKg <= 0 || reps <= 0) return undefined
  if (reps === 1) return weightKg
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10
}

/** Unit of an exercise from the plan; exercises outside the plan are weight × reps. */
export function exerciseUnit(name: string): ExerciseUnit {
  return findPlanExercise(name)?.unit ?? 'kg'
}

/** A logged set with enough context to display, edit or delete it. */
export interface LoggedSet extends StrengthSet {
  kind: Kind
  entryId: string
  /** Index within its entry's `sets` (legacy sets have no `id`). */
  setIndex: number
  date: IsoDate
  /** Session that wrote the entry; undefined for ad-hoc entries. */
  sessionId?: string
}

/** Everything logged for one exercise on one calendar date. */
export interface ExerciseDay {
  date: IsoDate
  /** Canonical name. */
  exerciseName: string
  unit: ExerciseUnit
  /** Every set of the day in logged order (entries by `createdAt`, then set order). */
  sets: LoggedSet[]
  workingSets: LoggedSet[]
  /** Heaviest working set; ties → more reps (earliest wins a full tie). */
  topSet?: LoggedSet
  topRpe?: number
  /**
   * Σ weight × reps over working sets for load-ranked exercises; Σ reps (seconds for
   * `seconds` exercises) when the exercise is done without load.
   */
  volume: number
  /** Best Epley estimate over working sets; undefined for `seconds` and unloaded bodyweight work. */
  e1rm?: number
  /** Ids of the log entries merged into this day. */
  entryIds: string[]
}

/** Compare by weight, then reps: > 0 when `a` is the better set. */
function compareSets(a: { weightKg: number; reps: number }, b: { weightKg: number; reps: number }): number {
  return a.weightKg - b.weightKg || a.reps - b.reps
}

/** Builds one ExerciseDay from entries already known to share a date and canonical name. */
function buildDay(date: IsoDate, exerciseName: string, entries: StrengthLogEntry[]): ExerciseDay {
  const unit = exerciseUnit(exerciseName)
  const ordered = [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const sets: LoggedSet[] = ordered.flatMap((entry) =>
    entry.sets.map((set, setIndex) => ({
      ...set,
      kind: setKind(set),
      entryId: entry.id,
      setIndex,
      date,
      sessionId: entry.sessionId,
    })),
  )
  const workingSets = sets.filter((s) => s.kind === 'working')

  let topSet: LoggedSet | undefined
  for (const s of workingSets) if (!topSet || compareSets(s, topSet) > 0) topSet = s

  const loaded = unit !== 'seconds' && workingSets.some((s) => s.weightKg > 0)
  let volume = 0
  let best: number | undefined
  for (const s of workingSets) {
    volume += loaded ? s.weightKg * s.reps : s.reps
    if (unit !== 'kg') continue
    const est = e1rm(s.weightKg, s.reps)
    if (est != null && (best == null || est > best)) best = est
  }

  return {
    date,
    exerciseName,
    unit,
    sets,
    workingSets,
    topSet,
    topRpe: topSet?.rpe,
    volume: Math.round(volume * 10) / 10,
    e1rm: best,
    entryIds: ordered.map((e) => e.id),
  }
}

/**
 * Groups entries by (date, canonical exercise name) into ExerciseDays. Dates newest first;
 * exercises within a date in the order they were first logged.
 */
export function groupStrengthByDay(strengthLog: readonly StrengthLogEntry[]): ExerciseDay[] {
  const groups = new Map<string, { date: IsoDate; name: string; entries: StrengthLogEntry[]; first: string }>()
  for (const entry of strengthLog) {
    const name = canonicalExerciseName(entry.exerciseName)
    const key = `${entry.date}\u0000${name}`
    const group = groups.get(key)
    if (group) {
      group.entries.push(entry)
      if (entry.createdAt < group.first) group.first = entry.createdAt
    } else {
      groups.set(key, { date: entry.date, name, entries: [entry], first: entry.createdAt })
    }
  }
  return [...groups.values()]
    .sort((a, b) => b.date.localeCompare(a.date) || a.first.localeCompare(b.first))
    .map((g) => buildDay(g.date, g.name, g.entries))
}

/**
 * One record per calendar date for an exercise (aliases resolved), newest first, merging
 * ALL entries of that date with or without `sessionId`.
 */
export function exerciseHistory(strengthLog: readonly StrengthLogEntry[], name: string): ExerciseDay[] {
  const canonical = canonicalExerciseName(name)
  return groupStrengthByDay(
    strengthLog.filter((e) => canonicalExerciseName(e.exerciseName) === canonical),
  )
}

/** Direction of the last top set vs the previous one. */
export type Trend = 'up' | 'flat' | 'down' | 'new'

/** Where an exercise stands, for the exercise list and detail screens. */
export interface ExerciseSummary {
  exerciseName: string
  unit: ExerciseUnit
  /** Most recent day with a working set. */
  last?: ExerciseDay
  /** The training day before `last`. */
  previous?: ExerciseDay
  /** All-time best top set (weight, then reps) and when. */
  best?: { set: LoggedSet; date: IsoDate }
  bestE1rm?: { value: number; date: IsoDate }
  /** Days with at least one working set. */
  trainingDays: number
  /** Last vs previous top set by weight then reps; 'new' without two training days. */
  trend: Trend
  /** RPE of the last top set. */
  lastRpe?: number
  /** Full per-day history (including warmup-only days), newest first. */
  history: ExerciseDay[]
}

/** Where an exercise stands: last/previous day, bests, trend and last RPE. */
export function exerciseSummary(strengthLog: readonly StrengthLogEntry[], name: string): ExerciseSummary {
  const exerciseName = canonicalExerciseName(name)
  const history = exerciseHistory(strengthLog, exerciseName)
  const training = history.filter((d) => d.topSet)
  const [last, previous] = training

  let best: ExerciseSummary['best']
  let bestE1rm: ExerciseSummary['bestE1rm']
  for (const day of training) {
    // Iterating newest-first and replacing on ties too leaves the date it was first achieved.
    if (!best || compareSets(day.topSet!, best.set) >= 0) best = { set: day.topSet!, date: day.date }
    if (day.e1rm != null && (!bestE1rm || day.e1rm >= bestE1rm.value)) {
      bestE1rm = { value: day.e1rm, date: day.date }
    }
  }

  let trend: Trend = 'new'
  if (last?.topSet && previous?.topSet) {
    const cmp = compareSets(last.topSet, previous.topSet)
    trend = cmp > 0 ? 'up' : cmp < 0 ? 'down' : 'flat'
  }

  return {
    exerciseName,
    unit: exerciseUnit(exerciseName),
    last,
    previous,
    best,
    bestE1rm,
    trainingDays: training.length,
    trend,
    lastRpe: last?.topRpe,
    history,
  }
}

/** One row of the exercise catalog: name, region, plan data and summary. */
export interface ExerciseOverview {
  exerciseName: string
  region: RegionKey
  /** First plan occurrence; undefined for exercises only ever logged. */
  planExercise?: PlanExercise
  summary: ExerciseSummary
}

/**
 * Every plan exercise (plan order, even with no history) followed by every other exercise
 * ever logged (most recently trained first), each with region and summary.
 */
export function allExerciseSummaries(strengthLog: readonly StrengthLogEntry[]): ExerciseOverview[] {
  const planNames = planExerciseNames()
  const inPlan = new Set(planNames)
  const extra: string[] = []
  const newestFirst = [...strengthLog].sort((a, b) => b.date.localeCompare(a.date))
  for (const entry of newestFirst) {
    const name = canonicalExerciseName(entry.exerciseName)
    if (!inPlan.has(name) && !extra.includes(name)) extra.push(name)
  }
  return [...planNames, ...extra].map((exerciseName) => ({
    exerciseName,
    region: regionOf(exerciseName),
    planExercise: findPlanExercise(exerciseName),
    summary: exerciseSummary(strengthLog, exerciseName),
  }))
}

/** Options for prefill lookups. */
export interface WorkingSetOptions {
  /**
   * Ignore one session's own entries. Without this an in-progress session seeds its own
   * prefill — log a light set and the next suggestion drops to it.
   */
  excludeSessionId?: string
}

/**
 * Prefill source: the top working set of the most recent day that has one (warmup-only
 * days fall through to older history). Undefined without history.
 */
export function lastWorkingSet(
  strengthLog: readonly StrengthLogEntry[],
  name: string,
  { excludeSessionId }: WorkingSetOptions = {},
): LoggedSet | undefined {
  const log =
    excludeSessionId == null ? strengthLog : strengthLog.filter((e) => e.sessionId !== excludeSessionId)
  return exerciseHistory(log, name).find((d) => d.topSet)?.topSet
}

const WARMUP_FRACTION = 0.6
const PLATE_STEP = 2.5

/** Warmup load ≈ 60% of the working load, rounded to the nearest 2.5 kg (at least 2.5 kg). */
export function warmupWeight(workingKg: number): number {
  return Math.max(Math.round((workingKg * WARMUP_FRACTION) / PLATE_STEP) * PLATE_STEP, PLATE_STEP)
}

/** RPE at or below which a reached target counts as "easy" → raise it. */
export const EASY_RPE = 7
/** Default load step for exercises outside the plan. */
const DEFAULT_STEP_KG = 2.5
/** Rep increase suggested for bodyweight exercises. */
const BODYWEIGHT_STEP_REPS = 1
/** Seconds increase suggested for timed exercises. */
const SECONDS_STEP = 5

/** Why the target is what it is: no history yet, raise it, or repeat. */
export type TargetHint = 'first' | 'increase' | 'hold'

/** Today's target for an exercise (see nextTarget). */
export interface NextTarget {
  hint: TargetHint
  unit: ExerciseUnit
  sets?: number
  /** Load to use (0 = bodyweight); undefined when unknown (no history, no startKg). */
  weightKg?: number
  /** Reps (seconds for `seconds`); undefined for a first 'max' set. */
  reps?: number
  /** Size of the suggested raise: kg for load, reps/seconds otherwise. */
  increaseBy?: number
  /** The set this target is based on. */
  basedOn?: LoggedSet
}

/**
 * Today's target for an exercise:
 * - 'first' — no history: plan `startKg` (kg exercises), else bodyweight/blank.
 * - 'increase' — the last top set reached the target reps (any count for 'max') at
 *   RPE ≤ 7: kg exercises get last weight + `stepKg`; bodyweight/seconds exercises keep
 *   the load and get more reps/seconds.
 * - 'hold' — otherwise (including a missing RPE): repeat the last weight.
 */
export function nextTarget(planExercise: PlanExercise | undefined, summary: ExerciseSummary): NextTarget {
  const unit = planExercise?.unit ?? summary.unit
  const sets = planExercise?.sets
  const targetReps = typeof planExercise?.reps === 'number' ? planExercise.reps : undefined
  const last = summary.last?.topSet

  if (!last) {
    return {
      hint: 'first',
      unit,
      sets,
      weightKg: unit === 'kg' ? planExercise?.startKg : 0,
      reps: targetReps,
    }
  }

  const reached = targetReps == null || last.reps >= targetReps
  const easy = last.rpe != null && last.rpe <= EASY_RPE
  if (!reached || !easy) {
    return { hint: 'hold', unit, sets, weightKg: last.weightKg, reps: targetReps ?? last.reps, basedOn: last }
  }

  if (unit === 'kg') {
    const step = planExercise?.stepKg ?? DEFAULT_STEP_KG
    return {
      hint: 'increase',
      unit,
      sets,
      weightKg: last.weightKg + step,
      reps: targetReps ?? last.reps,
      increaseBy: step,
      basedOn: last,
    }
  }
  const step = unit === 'seconds' ? SECONDS_STEP : BODYWEIGHT_STEP_REPS
  return {
    hint: 'increase',
    unit,
    sets,
    weightKg: last.weightKg,
    reps: last.reps + step,
    increaseBy: step,
    basedOn: last,
  }
}

/** The entries a session owns for one exercise (aliases resolved); never ad-hoc entries. */
export function sessionEntries(
  strengthLog: readonly StrengthLogEntry[],
  sessionId: string,
  exerciseName: string,
): StrengthLogEntry[] {
  const canonical = canonicalExerciseName(exerciseName)
  return strengthLog.filter(
    (e) => e.sessionId === sessionId && canonicalExerciseName(e.exerciseName) === canonical,
  )
}

/** Sets done vs planned for one exercise of an active session. */
export interface ExerciseProgress {
  exerciseName: string
  warmupDone: number
  workingDone: number
  targetSets: number
  done: boolean
}

/** Per-exercise and overall progress of an active session. */
export interface SessionProgress {
  exercises: ExerciseProgress[]
  /** Working sets done, each exercise capped at its target. */
  done: number
  /** Σ target sets. */
  total: number
  complete: boolean
}

/**
 * Working sets logged by `activeSessionId` per plan exercise (plan order) against the plan's
 * target sets. Exercise names are unique within a session (checked by plan.test.ts).
 */
export function sessionProgress(
  session: Session,
  strengthLog: readonly StrengthLogEntry[],
  activeSessionId: string,
): SessionProgress {
  const exercises = sessionExercises(session).map((ex) => {
    const sets = sessionEntries(strengthLog, activeSessionId, ex.name).flatMap((e) => e.sets)
    const warmupDone = sets.filter((s) => setKind(s) === 'warmup').length
    const workingDone = sets.length - warmupDone
    return {
      exerciseName: ex.name,
      warmupDone,
      workingDone,
      targetSets: ex.sets,
      done: workingDone >= ex.sets,
    }
  })
  const done = exercises.reduce((n, p) => n + Math.min(p.workingDone, p.targetSets), 0)
  const total = exercises.reduce((n, p) => n + p.targetSets, 0)
  return { exercises, done, total, complete: done >= total }
}

/** Canonical names of the exercises logged on `date` (any set kind). */
export function loggedExerciseNames(strengthLog: readonly StrengthLogEntry[], date: IsoDate): Set<string> {
  return new Set(
    strengthLog.filter((e) => e.date === date).map((e) => canonicalExerciseName(e.exerciseName)),
  )
}
