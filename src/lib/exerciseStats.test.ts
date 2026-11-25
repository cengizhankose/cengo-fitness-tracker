import { describe, expect, it } from 'vitest'
import {
  allExerciseSummaries,
  e1rm,
  exerciseHistory,
  exerciseSummary,
  groupStrengthByDay,
  lastWorkingSet,
  loggedExerciseNames,
  nextTarget,
  sessionProgress,
  setKind,
  warmupWeight,
} from '@/lib/exerciseStats'
import { findPlanExercise, planExerciseNames, sessionById } from '@/lib/plan'
import type { StrengthLogEntry, StrengthSet } from '@/types/userData'

let seq = 0
function entry(
  exerciseName: string,
  sets: StrengthSet[],
  over: Partial<StrengthLogEntry> = {},
): StrengthLogEntry {
  seq += 1
  const date = over.date ?? '2026-11-16'
  return {
    id: `e${seq}`,
    date,
    exerciseName,
    sets,
    createdAt: `${date}T07:${String(seq % 60).padStart(2, '0')}:00.000Z`,
    ...over,
  }
}

/** Production strengthLog on 2026-11-16: single-set entries, no sessionId, logged in this order. */
const REAL_DAY: StrengthLogEntry[] = [
  entry('Incline Dumbbell Press', [{ weightKg: 30, reps: 7, rpe: 8 }], { id: 'r1', createdAt: '2026-11-16T06:10:00.000Z' }),
  entry('Pull Up / Lat Pulldown', [{ weightKg: 60, reps: 10, rpe: 9 }], { id: 'r2', createdAt: '2026-11-16T06:15:00.000Z' }),
  entry('Machine Chest Press', [{ weightKg: 40, reps: 10, rpe: 7 }], { id: 'r3', createdAt: '2026-11-16T06:20:00.000Z' }),
  entry('Machine Chest Press', [{ weightKg: 40, reps: 12, rpe: 7 }], { id: 'r4', createdAt: '2026-11-16T06:23:00.000Z' }),
  entry('Seated Cable Row', [{ weightKg: 50, reps: 10, rpe: 9 }], { id: 'r5', createdAt: '2026-11-16T06:27:00.000Z' }),
  entry('Lateral Raise', [{ weightKg: 10, reps: 20, rpe: 8 }], { id: 'r6', createdAt: '2026-11-16T06:31:00.000Z' }),
  entry('Cable Curl', [{ weightKg: 25, reps: 12, rpe: 8 }], { id: 'r7', createdAt: '2026-11-16T06:35:00.000Z' }),
  entry('Rope Pushdown', [{ weightKg: 35, reps: 12, rpe: 7 }], { id: 'r8', createdAt: '2026-11-16T06:38:00.000Z' }),
]

describe('setKind', () => {
  it('treats a legacy set with no kind as working and respects an explicit kind', () => {
    expect(setKind({ weightKg: 50, reps: 8 })).toBe('working')
    expect(setKind({ weightKg: 30, reps: 10, kind: 'warmup' })).toBe('warmup')
  })
})

describe('e1rm', () => {
  it('uses Epley, returns the load itself for a single, and nothing without load', () => {
    expect(e1rm(100, 5)).toBe(116.7)
    expect(e1rm(40, 12)).toBe(56)
    expect(e1rm(100, 1)).toBe(100)
    expect(e1rm(0, 10)).toBeUndefined()
  })
})

describe('exerciseHistory — real 2026-11-16 data', () => {
  it('merges the two Machine Chest Press entries into one day with both sets in logged order', () => {
    const [day, ...rest] = exerciseHistory(REAL_DAY, 'Machine Chest Press')
    expect(rest).toEqual([])
    expect(day!.date).toBe('2026-11-16')
    expect(day!.sets.map((s) => [s.weightKg, s.reps])).toEqual([
      [40, 10],
      [40, 12],
    ])
    expect(day!.entryIds).toEqual(['r3', 'r4'])
    expect(day!.sets.map((s) => s.entryId)).toEqual(['r3', 'r4'])
  })

  it('breaks a weight tie by reps for the top set', () => {
    const [day] = exerciseHistory(REAL_DAY, 'Machine Chest Press')
    expect(day!.topSet).toMatchObject({ weightKg: 40, reps: 12, entryId: 'r4' })
    expect(day!.topRpe).toBe(7)
    expect(day!.volume).toBe(880)
    expect(day!.e1rm).toBe(56)
  })

  it('resolves the "Pull Up / Lat Pulldown" alias to Lat Pulldown both ways', () => {
    const byCanonical = exerciseHistory(REAL_DAY, 'Lat Pulldown')
    expect(byCanonical).toHaveLength(1)
    expect(byCanonical[0]!.exerciseName).toBe('Lat Pulldown')
    expect(byCanonical[0]!.topSet).toMatchObject({ weightKg: 60, reps: 10, rpe: 9 })
    expect(exerciseHistory(REAL_DAY, 'Pull Up / Lat Pulldown')).toEqual(byCanonical)
    // The bodyweight "Pull Up" is a different exercise.
    expect(exerciseHistory(REAL_DAY, 'Pull Up')).toEqual([])
  })

  it('merges entries with and without sessionId on the same date', () => {
    const log = [
      ...REAL_DAY,
      entry('Machine Chest Press', [{ id: 's-a', weightKg: 45, reps: 8, rpe: 9, kind: 'working' }], {
        id: 'sess',
        sessionId: 'S1',
        createdAt: '2026-11-16T06:50:00.000Z',
      }),
    ]
    const days = exerciseHistory(log, 'Machine Chest Press')
    expect(days).toHaveLength(1)
    expect(days[0]!.sets.map((s) => s.entryId)).toEqual(['r3', 'r4', 'sess'])
    expect(days[0]!.sets[2]!.sessionId).toBe('S1')
    expect(days[0]!.topSet).toMatchObject({ weightKg: 45, reps: 8 })
  })

  it('orders days newest first', () => {
    const log = [
      entry('Bench Press', [{ weightKg: 80, reps: 5 }], { date: '2026-11-10' }),
      entry('Bench Press', [{ weightKg: 82.5, reps: 5 }], { date: '2026-11-17' }),
    ]
    expect(exerciseHistory(log, 'Bench Press').map((d) => d.date)).toEqual(['2026-11-17', '2026-11-10'])
  })
})

describe('exerciseHistory — set kinds and units', () => {
  it('excludes warmup sets from the top set, volume and e1RM but still lists them', () => {
    const [day] = exerciseHistory(
      [
        entry('Bench Press', [
          { weightKg: 100, reps: 3, kind: 'warmup' },
          { weightKg: 80, reps: 5, rpe: 9, kind: 'working' },
        ]),
      ],
      'Bench Press',
    )
    expect(day!.sets).toHaveLength(2)
    expect(day!.workingSets).toHaveLength(1)
    expect(day!.topSet).toMatchObject({ weightKg: 80, reps: 5 })
    expect(day!.volume).toBe(400)
  })

  it('ranks seconds exercises by seconds with no e1RM', () => {
    const [day] = exerciseHistory(
      [entry('Plank', [{ weightKg: 0, reps: 45 }, { weightKg: 0, reps: 60 }])],
      'Plank',
    )
    expect(day!.unit).toBe('seconds')
    expect(day!.topSet!.reps).toBe(60)
    expect(day!.e1rm).toBeUndefined()
    expect(day!.volume).toBe(105)
  })

  it('ranks unloaded bodyweight work by reps with no e1RM', () => {
    const [day] = exerciseHistory(
      [entry('Push Up', [{ weightKg: 0, reps: 15 }, { weightKg: 0, reps: 18 }])],
      'Push Up',
    )
    expect(day!.topSet!.reps).toBe(18)
    expect(day!.e1rm).toBeUndefined()
    expect(day!.volume).toBe(33)
  })

  it('prefers added load over more reps for bodyweight exercises', () => {
    const [day] = exerciseHistory(
      [entry('Pull Up', [{ weightKg: 0, reps: 10 }, { weightKg: 10, reps: 5 }])],
      'Pull Up',
    )
    expect(day!.topSet).toMatchObject({ weightKg: 10, reps: 5 })
    expect(day!.e1rm).toBeUndefined()
  })
})

describe('exerciseSummary', () => {
  const bench = (date: string, weightKg: number, reps: number, rpe?: number) =>
    entry('Bench Press', [{ weightKg, reps, rpe }], { date })

  it('reports trend by weight then reps', () => {
    expect(exerciseSummary([bench('2026-11-10', 80, 5), bench('2026-11-17', 82.5, 4)], 'Bench Press').trend).toBe('up')
    expect(exerciseSummary([bench('2026-11-10', 80, 5), bench('2026-11-17', 80, 6)], 'Bench Press').trend).toBe('up')
    expect(exerciseSummary([bench('2026-11-10', 80, 5), bench('2026-11-17', 80, 5)], 'Bench Press').trend).toBe('flat')
    expect(exerciseSummary([bench('2026-11-10', 80, 5), bench('2026-11-17', 80, 4)], 'Bench Press').trend).toBe('down')
    expect(exerciseSummary([bench('2026-11-17', 80, 5)], 'Bench Press').trend).toBe('new')
    expect(exerciseSummary([], 'Bench Press').trend).toBe('new')
  })

  it('tracks last, previous, all-time best, best e1RM, training days and last RPE', () => {
    const s = exerciseSummary(
      [bench('2026-11-03', 85, 5, 10), bench('2026-11-10', 80, 5, 8), bench('2026-11-17', 82.5, 5, 9)],
      'Bench Press',
    )
    expect(s.last?.date).toBe('2026-11-17')
    expect(s.previous?.date).toBe('2026-11-10')
    expect(s.best).toMatchObject({ date: '2026-11-03', set: { weightKg: 85, reps: 5 } })
    expect(s.bestE1rm).toEqual({ value: 99.2, date: '2026-11-03' })
    expect(s.trainingDays).toBe(3)
    expect(s.lastRpe).toBe(9)
  })

  it('skips warmup-only days for last/previous but keeps them in history', () => {
    const s = exerciseSummary(
      [
        bench('2026-11-10', 80, 5, 8),
        entry('Bench Press', [{ weightKg: 40, reps: 10, kind: 'warmup' }], { date: '2026-11-17' }),
      ],
      'Bench Press',
    )
    expect(s.last?.date).toBe('2026-11-10')
    expect(s.previous).toBeUndefined()
    expect(s.trainingDays).toBe(1)
    expect(s.history).toHaveLength(2)
  })
})

describe('allExerciseSummaries', () => {
  const log = [...REAL_DAY, entry('Weighted Chin Up', [{ weightKg: 10, reps: 6 }], { date: '2026-08-03' })]
  const all = allExerciseSummaries(log)

  it('lists every plan exercise first in plan order, then other logged exercises', () => {
    const names = all.map((o) => o.exerciseName)
    expect(names.slice(0, planExerciseNames().length)).toEqual(planExerciseNames())
    expect(names.slice(planExerciseNames().length)).toEqual(['Weighted Chin Up'])
    expect(names).not.toContain('Pull Up / Lat Pulldown')
  })

  it('includes plan exercises without history and carries region + plan data', () => {
    const squat = all.find((o) => o.exerciseName === 'Squat')!
    expect(squat.summary.trainingDays).toBe(0)
    expect(squat.region).toBe('legs')
    expect(squat.planExercise?.startKg).toBe(100)
    const chin = all.find((o) => o.exerciseName === 'Weighted Chin Up')!
    expect(chin.region).toBe('back')
    expect(chin.planExercise).toBeUndefined()
    expect(all.find((o) => o.exerciseName === 'Lat Pulldown')!.summary.last?.topSet?.weightKg).toBe(60)
  })
})

describe('lastWorkingSet', () => {
  it('returns the top working set of the most recent day', () => {
    expect(lastWorkingSet(REAL_DAY, 'Machine Chest Press')).toMatchObject({ weightKg: 40, reps: 12 })
  })

  it('falls through a warmup-only day to real history', () => {
    const log = [
      entry('Squat', [{ weightKg: 100, reps: 5 }], { date: '2026-11-11' }),
      entry('Squat', [{ weightKg: 40, reps: 10, kind: 'warmup' }], { date: '2026-11-18', sessionId: 'dead' }),
    ]
    expect(lastWorkingSet(log, 'Squat')).toMatchObject({ weightKg: 100, date: '2026-11-11' })
  })

  it('excludes the current session so it cannot seed its own prefill', () => {
    const log = [
      entry('Squat', [{ weightKg: 100, reps: 5 }], { date: '2026-11-11' }),
      entry('Squat', [{ weightKg: 60, reps: 5, kind: 'working' }], { date: '2026-11-18', sessionId: 'S1' }),
    ]
    expect(lastWorkingSet(log, 'Squat', { excludeSessionId: 'S1' })?.weightKg).toBe(100)
    expect(lastWorkingSet(log, 'Squat', { excludeSessionId: 'S2' })?.weightKg).toBe(60)
    expect(lastWorkingSet([], 'Squat')).toBeUndefined()
  })
})

describe('warmupWeight', () => {
  it('is ~60% rounded to 2.5 kg, never below 2.5 kg', () => {
    expect(warmupWeight(50)).toBe(30)
    expect(warmupWeight(62.5)).toBe(37.5)
    expect(warmupWeight(2)).toBe(2.5)
  })
})

describe('nextTarget', () => {
  const target = (name: string, log: StrengthLogEntry[]) =>
    nextTarget(findPlanExercise(name), exerciseSummary(log, name))
  const one = (name: string, weightKg: number, reps: number, rpe?: number) => [
    entry(name, [{ weightKg, reps, rpe }]),
  ]

  it("'first': uses startKg and the plan reps without history", () => {
    expect(target('Bench Press', [])).toEqual({ hint: 'first', unit: 'kg', sets: 1, weightKg: 80, reps: 5 })
  })

  it("'first': leaves the load blank when the plan has no startKg", () => {
    expect(target('Shoulder Press', [])).toMatchObject({ hint: 'first', weightKg: undefined, reps: 8 })
  })

  it("'first': bodyweight and seconds exercises start unloaded; 'max' has no rep target", () => {
    expect(target('Pull Up', [])).toMatchObject({ hint: 'first', unit: 'bodyweight', weightKg: 0, reps: undefined })
    expect(target('Plank', [])).toMatchObject({ hint: 'first', unit: 'seconds', weightKg: 0, reps: 45 })
  })

  it("'increase': target reps at RPE ≤ 7 → last weight + stepKg", () => {
    expect(target('Bench Press', one('Bench Press', 80, 5, 7))).toMatchObject({
      hint: 'increase',
      weightKg: 82.5,
      reps: 5,
      increaseBy: 2.5,
    })
    expect(target('Squat', one('Squat', 100, 5, 6))).toMatchObject({ hint: 'increase', weightKg: 105 })
  })

  it("'increase' on the real data: Machine Chest Press 40×12 @ RPE 7", () => {
    expect(target('Machine Chest Press', REAL_DAY)).toMatchObject({ hint: 'increase', weightKg: 42.5, reps: 12 })
  })

  it("'hold': hard RPE, missed reps or unknown RPE repeat the last weight", () => {
    expect(target('Bench Press', one('Bench Press', 80, 5, 8))).toMatchObject({ hint: 'hold', weightKg: 80, reps: 5 })
    expect(target('Bench Press', one('Bench Press', 80, 4, 6))).toMatchObject({ hint: 'hold', weightKg: 80 })
    expect(target('Bench Press', one('Bench Press', 80, 5))).toMatchObject({ hint: 'hold', weightKg: 80 })
    // Real data: Lateral Raise 10×20 @ RPE 8 → hold 10 kg at the plan's 15 reps.
    expect(target('Lateral Raise', REAL_DAY)).toMatchObject({ hint: 'hold', weightKg: 10, reps: 15 })
  })

  it("'increase' for bodyweight suggests one more rep and keeps any added load", () => {
    expect(target('Push Up', one('Push Up', 0, 15, 6))).toMatchObject({
      hint: 'increase',
      weightKg: 0,
      reps: 16,
      increaseBy: 1,
    })
    expect(target('Pull Up', one('Pull Up', 5, 8, 7))).toMatchObject({ hint: 'increase', weightKg: 5, reps: 9 })
  })

  it("'increase' for seconds suggests 5 more seconds", () => {
    expect(target('Plank', one('Plank', 0, 45, 6))).toMatchObject({ hint: 'increase', reps: 50, increaseBy: 5 })
    expect(target('Plank', one('Plank', 0, 40, 6))).toMatchObject({ hint: 'hold', reps: 45 })
  })

  it('uses a 2.5 kg default step for exercises outside the plan', () => {
    expect(nextTarget(undefined, exerciseSummary(one('Weighted Chin Up', 10, 6, 7), 'Weighted Chin Up'))).toMatchObject({
      hint: 'increase',
      weightKg: 12.5,
      reps: 6,
    })
  })
})

describe('sessionProgress', () => {
  const pull = sessionById('pull')!

  it('counts the active session working sets per exercise against plan targets', () => {
    const log = [
      entry('Deadlift', [
        { weightKg: 60, reps: 5, kind: 'warmup' },
        { weightKg: 120, reps: 5, kind: 'working' },
      ], { sessionId: 'S1' }),
      entry('Face Pull', [{ weightKg: 20, reps: 15, kind: 'working' }], { sessionId: 'S1' }),
      // Ad-hoc and other-session entries never count.
      entry('Seated Cable Row', [{ weightKg: 50, reps: 10 }]),
      entry('Pull Up', [{ weightKg: 0, reps: 8 }], { sessionId: 'S0' }),
    ]
    const p = sessionProgress(pull, log, 'S1')
    expect(p.exercises.map((e) => e.exerciseName)).toEqual([
      'Deadlift',
      'Pull Up',
      'Seated Cable Row',
      'Face Pull',
      'Cable Curl',
      'Hanging Leg Raise',
    ])
    expect(p.exercises[0]).toEqual({ exerciseName: 'Deadlift', warmupDone: 1, workingDone: 1, targetSets: 1, done: true })
    expect(p.exercises[3]).toMatchObject({ workingDone: 1, targetSets: 2, done: false })
    expect(p).toMatchObject({ done: 2, total: 9, complete: false })
  })

  it('caps over-done exercises at their target in the overall count', () => {
    const log = [entry('Deadlift', [{ weightKg: 120, reps: 5 }, { weightKg: 120, reps: 4 }], { sessionId: 'S1' })]
    expect(sessionProgress(pull, log, 'S1').done).toBe(1)
  })
})

describe('loggedExerciseNames', () => {
  it('returns canonical names logged on the date', () => {
    const names = loggedExerciseNames(REAL_DAY, '2026-11-16')
    expect(names.has('Lat Pulldown')).toBe(true)
    expect(names.size).toBe(7)
    expect(loggedExerciseNames(REAL_DAY, '2026-11-17').size).toBe(0)
  })
})

describe('groupStrengthByDay', () => {
  it('flags a day as split from its superset only when an entry has splitFromSuperset true', () => {
    const log = [
      entry('Cable Curl', [{ weightKg: 25, reps: 12 }], { date: '2026-11-16' }),
      entry('Cable Curl', [{ weightKg: 25, reps: 10 }], { date: '2026-11-16', splitFromSuperset: true }),
      entry('Cable Curl', [{ weightKg: 25, reps: 12 }], {
        date: '2026-11-17',
        createdAt: '2026-11-17T07:00:00.000Z',
        splitFromSuperset: false,
      }),
      entry('Rope Pushdown', [{ weightKg: 35, reps: 12 }], {
        date: '2026-11-17',
        createdAt: '2026-11-17T07:05:00.000Z',
      }),
    ]
    const flags = groupStrengthByDay(log).map((d) => [d.date, d.exerciseName, d.splitFromSuperset])
    expect(flags).toEqual([
      ['2026-11-17', 'Cable Curl', false],
      ['2026-11-17', 'Rope Pushdown', false],
      ['2026-11-16', 'Cable Curl', true],
    ])
  })
})
