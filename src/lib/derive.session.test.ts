import { describe, it, expect } from 'vitest'
import {
  setKind,
  sessionEntry,
  sessionSets,
  sessionProgress,
  parseRepRange,
  defaultRepsFor,
  parseIntensityRpe,
  suggestedWeight,
  lastWeightForExercise,
} from '@/lib/derive'
import type { StrengthDay } from '@/types/plan'
import type { StrengthLogEntry } from '@/types/userData'

const DAY: StrengthDay = {
  day: 'Monday',
  type: 'strength',
  title: 'Upper A',
  postWorkoutStretchingId: 'strength_stretch_5min',
  exercises: [
    { name: 'Bench', warmupSets: 2, workingSets: 1, repRange: '6-10', intensity: 'RPE 9-10' },
    { name: 'Row', warmupSets: 0, workingSets: 3, repRange: 'controlled', intensity: 'clean reps' },
  ],
}

function entry(over: Partial<StrengthLogEntry> = {}): StrengthLogEntry {
  return {
    id: 'e1',
    date: '2026-08-03',
    exerciseName: 'Bench',
    sets: [{ weightKg: 50, reps: 8 }],
    createdAt: '2026-08-03T10:00:00.000Z',
    ...over,
  }
}

describe('setKind', () => {
  it('treats a legacy set with no kind as a working set', () => {
    expect(setKind({ weightKg: 50, reps: 8 })).toBe('working')
  })

  it('respects an explicit kind', () => {
    expect(setKind({ weightKg: 30, reps: 10, kind: 'warmup' })).toBe('warmup')
    expect(setKind({ weightKg: 50, reps: 8, kind: 'working' })).toBe('working')
  })
})

describe('sessionEntry / sessionSets', () => {
  const log = [
    entry({ id: 'legacy', sets: [{ weightKg: 40, reps: 10 }] }),
    entry({
      id: 'owned',
      sessionId: 's1',
      sets: [
        { id: 'a', weightKg: 30, reps: 10, kind: 'warmup' },
        { id: 'b', weightKg: 60, reps: 8, kind: 'working' },
      ],
    }),
  ]

  it('finds only the entry owned by the session', () => {
    expect(sessionEntry(log, 's1', 'Bench')?.id).toBe('owned')
  })

  it('never matches entries without a sessionId', () => {
    expect(sessionEntry(log, 's2', 'Bench')).toBeUndefined()
    expect(sessionSets(log, 's2', 'Bench')).toEqual([])
  })

  it('returns the session entry sets', () => {
    expect(sessionSets(log, 's1', 'Bench')).toHaveLength(2)
  })
})

describe('sessionProgress', () => {
  it('counts warmup and working sets separately against the plan targets', () => {
    const log = [
      entry({
        id: 'owned',
        sessionId: 's1',
        sets: [
          { id: 'a', weightKg: 30, reps: 10, kind: 'warmup' },
          { id: 'b', weightKg: 40, reps: 10, kind: 'warmup' },
          { id: 'c', weightKg: 60, reps: 8, kind: 'working' },
        ],
      }),
    ]
    const [bench, row] = sessionProgress(DAY, log, 's1')

    expect(bench).toMatchObject({
      exerciseName: 'Bench',
      warmupDone: 2,
      workingDone: 1,
      warmupTarget: 2,
      workingTarget: 1,
      done: true,
    })
    expect(row).toMatchObject({ workingDone: 0, workingTarget: 3, done: false })
  })

  it('counts a kind-less set as working (old data mid-session)', () => {
    const log = [entry({ id: 'owned', sessionId: 's1', sets: [{ id: 'a', weightKg: 60, reps: 8 }] })]
    expect(sessionProgress(DAY, log, 's1')[0]?.workingDone).toBe(1)
  })

  it('reports nothing done for an empty log', () => {
    expect(sessionProgress(DAY, [], 's1').every((p) => !p.done)).toBe(true)
  })
})

describe('parseRepRange / defaultRepsFor', () => {
  it('parses numeric ranges', () => {
    expect(parseRepRange('6-10')).toEqual({ min: 6, max: 10 })
    expect(parseRepRange('12-20')).toEqual({ min: 12, max: 20 })
  })

  it('returns undefined for qualitative ranges', () => {
    expect(parseRepRange('controlled')).toBeUndefined()
  })

  it('seeds the editor with the mid-point, or 10 as a fallback', () => {
    expect(defaultRepsFor('6-10')).toBe(8)
    expect(defaultRepsFor('8-12')).toBe(10)
    expect(defaultRepsFor('12-20')).toBe(16)
    expect(defaultRepsFor('controlled')).toBe(10)
  })
})

describe('parseIntensityRpe', () => {
  it('reads the lower bound of an RPE prescription', () => {
    expect(parseIntensityRpe('RPE 9-10')).toBe(9)
    expect(parseIntensityRpe('RPE 7')).toBe(7)
  })

  it('returns undefined for qualitative intensities', () => {
    expect(parseIntensityRpe('clean reps')).toBeUndefined()
  })
})

describe('suggestedWeight', () => {
  const log = [entry({ sets: [{ weightKg: 50, reps: 8 }] })]

  it('suggests the last working weight for a working set', () => {
    expect(suggestedWeight(log, 'Bench', 'working')).toBe(50)
  })

  it('suggests ~60% rounded to the nearest 2.5kg for a warmup', () => {
    expect(suggestedWeight(log, 'Bench', 'warmup')).toBe(30)
    expect(suggestedWeight([entry({ sets: [{ weightKg: 62.5, reps: 6 }] })], 'Bench', 'warmup')).toBe(
      37.5,
    )
  })

  it('returns undefined without history', () => {
    expect(suggestedWeight([], 'Bench', 'working')).toBeUndefined()
    expect(suggestedWeight(log, 'Unknown', 'warmup')).toBeUndefined()
  })

  it('is derived from history, not from the warmup just logged in this session', () => {
    const contaminated = [
      entry({
        id: 'current',
        sessionId: 's1',
        createdAt: '2026-08-10T10:00:00.000Z',
        sets: [{ id: 'w', weightKg: 30, reps: 10, kind: 'warmup' }],
      }),
      entry({
        id: 'history',
        createdAt: '2026-08-03T10:00:00.000Z',
        sets: [{ weightKg: 80, reps: 6, kind: 'working' }],
      }),
    ]

    expect(suggestedWeight(contaminated, 'Bench', 'working', { excludeSessionId: 's1' })).toBe(80)
    expect(suggestedWeight(contaminated, 'Bench', 'warmup', { excludeSessionId: 's1' })).toBe(47.5)
  })
})

describe('lastWeightForExercise', () => {
  it('still returns the heaviest working set of the most recent entry', () => {
    const log = [
      entry({
        id: 'multi',
        createdAt: '2026-08-05T10:00:00.000Z',
        sets: [
          { weightKg: 30, reps: 10, kind: 'warmup' },
          { weightKg: 40, reps: 10, kind: 'warmup' },
          { weightKg: 70, reps: 6, kind: 'working' },
        ],
      }),
      entry({ id: 'older', createdAt: '2026-08-01T10:00:00.000Z' }),
    ]
    expect(lastWeightForExercise(log, 'Bench')).toBe(70)
  })

  it('ignores warmup sets even when they are the heaviest thing on record', () => {
    const log = [
      entry({
        createdAt: '2026-08-05T10:00:00.000Z',
        sets: [
          { weightKg: 90, reps: 3, kind: 'warmup' },
          { weightKg: 60, reps: 8, kind: 'working' },
        ],
      }),
    ]
    expect(lastWeightForExercise(log, 'Bench')).toBe(60)
  })

  it('skips an abandoned warmup-only session and falls back to real history', () => {
    const log = [
      entry({
        id: 'abandoned',
        sessionId: 'dead',
        createdAt: '2026-08-06T10:00:00.000Z',
        sets: [
          { weightKg: 20, reps: 12, kind: 'warmup' },
          { weightKg: 30, reps: 10, kind: 'warmup' },
        ],
      }),
      entry({
        id: 'history',
        createdAt: '2026-08-01T10:00:00.000Z',
        sets: [{ weightKg: 75, reps: 6, kind: 'working' }],
      }),
    ]
    expect(lastWeightForExercise(log, 'Bench')).toBe(75)
  })

  it('excludes the current session so it cannot seed its own suggestion', () => {
    const log = [
      entry({
        id: 'current',
        sessionId: 's1',
        createdAt: '2026-08-10T10:00:00.000Z',
        sets: [{ weightKg: 100, reps: 5, kind: 'working' }],
      }),
      entry({
        id: 'history',
        createdAt: '2026-08-03T10:00:00.000Z',
        sets: [{ weightKg: 60, reps: 8, kind: 'working' }],
      }),
    ]

    expect(lastWeightForExercise(log, 'Bench', { excludeSessionId: 's1' })).toBe(60)
    // Another session's finished work is legitimate history.
    expect(lastWeightForExercise(log, 'Bench', { excludeSessionId: 's2' })).toBe(100)
  })

  it('counts legacy sets with no kind as working', () => {
    const log = [entry({ createdAt: '2026-08-05T10:00:00.000Z', sets: [{ weightKg: 55, reps: 8 }] })]
    expect(lastWeightForExercise(log, 'Bench')).toBe(55)
  })

  it('returns undefined when only warmups were ever logged', () => {
    const log = [entry({ sets: [{ weightKg: 30, reps: 10, kind: 'warmup' }] })]
    expect(lastWeightForExercise(log, 'Bench')).toBeUndefined()
  })
})
