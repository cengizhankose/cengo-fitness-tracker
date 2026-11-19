// Pure helpers of the session screen: how the running session's exercises are laid out
// (plan order, supersets grouped, added exercises last) and where the cursor goes after a set.

import { formatNumber, formatSet } from '@/lib/format'
import { sessionExercises } from '@/lib/plan'
import type { ExerciseUnit, PlanExercise, Session } from '@/types/plan'
import type { SetKind, StrengthSet } from '@/types/userData'

/** One exercise of the running session. */
export interface SessionExerciseRef {
  name: string
  /** Position in `ActiveSession.exerciseNames` (the cursor value). */
  index: number
  /** The plan prescription of THIS session; undefined for exercises added on the fly. */
  planExercise?: PlanExercise
}

export type SessionGroup =
  | { kind: 'single'; exercise: SessionExerciseRef }
  | { kind: 'superset'; exercises: SessionExerciseRef[] }

export function groupMembers(group: SessionGroup): SessionExerciseRef[] {
  return group.kind === 'single' ? [group.exercise] : group.exercises
}

/**
 * The session's exercises in plan order with supersets grouped, followed by every exercise
 * that is not part of the plan session (added during the workout, or a free session) in the
 * order it was added.
 */
export function sessionLayout(exerciseNames: readonly string[], session: Session | undefined): SessionGroup[] {
  const indexOf = new Map(exerciseNames.map((name, index) => [name, index]))
  const groups: SessionGroup[] = []
  const used = new Set<string>()
  const ref = (ex: PlanExercise): SessionExerciseRef | undefined => {
    const index = indexOf.get(ex.name)
    if (index === undefined) return undefined
    used.add(ex.name)
    return { name: ex.name, index, planExercise: ex }
  }

  for (const item of session?.items ?? []) {
    const members = (item.kind === 'single' ? [item.exercise] : item.exercises)
      .map(ref)
      .filter((m): m is SessionExerciseRef => m !== undefined)
    const [first] = members
    if (!first) continue
    if (item.kind === 'superset' && members.length > 1) groups.push({ kind: 'superset', exercises: members })
    else groups.push({ kind: 'single', exercise: first })
  }
  exerciseNames.forEach((name, index) => {
    if (!used.has(name)) groups.push({ kind: 'single', exercise: { name, index } })
  })
  return groups
}

/** Plan exercises of a session by name (empty for a free session). */
export function planExercisesByName(session: Session | undefined): Map<string, PlanExercise> {
  return new Map(session ? sessionExercises(session).map((ex) => [ex.name, ex]) : [])
}

/** Superset rounds: the most sets any member has, and how many every member has completed. */
export function supersetRounds(
  members: readonly SessionExerciseRef[],
  workingDone: (name: string) => number,
): { done: number; total: number } {
  const total = Math.max(0, ...members.map((m) => m.planExercise?.sets ?? 0))
  const done = Math.min(total, ...members.map((m) => workingDone(m.name)))
  return { done, total }
}

/**
 * Where the cursor goes after a working set was saved on `current` (counts already
 * include that set). Inside a superset: the next member (cyclic) that still has sets
 * left, so members alternate round by round. Otherwise, once `current` reached its target
 * sets: the next unfinished plan exercise after it (wrapping). Undefined = stay.
 * Exercises without a target never pull the cursor.
 */
export function nextExerciseIndex(
  groups: readonly SessionGroup[],
  workingDone: (name: string) => number,
  current: string,
): number | undefined {
  const unfinished = (ex: SessionExerciseRef) =>
    ex.planExercise !== undefined && workingDone(ex.name) < ex.planExercise.sets

  const group = groups.find((g) => groupMembers(g).some((m) => m.name === current))
  if (!group) return undefined
  const members = groupMembers(group)
  const at = members.findIndex((m) => m.name === current)
  const self = members[at]
  if (!self?.planExercise) return undefined

  if (group.kind === 'superset') {
    for (let k = 1; k <= members.length; k++) {
      const ex = members[(at + k) % members.length]
      if (ex && unfinished(ex)) return ex.index === self.index ? undefined : ex.index
    }
  } else if (unfinished(self)) {
    return undefined
  }

  const flat = groups.flatMap(groupMembers)
  const pos = flat.findIndex((m) => m.name === current)
  for (let k = 1; k < flat.length; k++) {
    const ex = flat[(pos + k) % flat.length]
    if (ex && unfinished(ex)) return ex.index
  }
  return undefined
}

/** "80 kg × 5 · RPE 9" — a set with its effort when recorded. */
export function formatLoggedSet(set: Pick<StrengthSet, 'weightKg' | 'reps' | 'rpe'>, unit: ExerciseUnit): string {
  const base = formatSet(set, unit)
  return set.rpe != null ? `${base} · RPE ${formatNumber(set.rpe)}` : base
}

/** Rest after a logged set, in seconds: two minutes after a working set, one after a warmup. */
export const REST_SECONDS: Record<SetKind, number> = { working: 120, warmup: 60 }

/** What one tap of "−15" / "+15" moves the end of the rest by. */
export const REST_STEP_SECONDS = 15
