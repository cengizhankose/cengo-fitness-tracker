import { describe, it, expect, beforeEach } from 'vitest'
import { useStore, SCHEMA_VERSION } from '@/store'
import { setKind } from '@/lib/exerciseStats'

const DATE = '2026-08-03'
const NAMES = ['Bench', 'Row', 'Curl']

const s = () => useStore.getState()

beforeEach(() => {
  s().resetAll()
})

describe('session cursor', () => {
  it('starts, moves and clears', () => {
    const id = s().startSession(DATE, 'pull', NAMES)

    expect(s().activeSession).toMatchObject({
      id,
      date: DATE,
      planSessionId: 'pull',
      exerciseNames: NAMES,
      currentIndex: 0,
    })

    s().setSessionIndex(2)
    expect(s().activeSession?.currentIndex).toBe(2)

    s().finishSession()
    expect(s().activeSession).toBeUndefined()
  })

  it('clamps the index to the snapshotted exercise list', () => {
    s().startSession(DATE, 'pull', NAMES)

    s().setSessionIndex(99)
    expect(s().activeSession?.currentIndex).toBe(2)

    s().setSessionIndex(-5)
    expect(s().activeSession?.currentIndex).toBe(0)
  })

  it('discardSession clears the cursor without touching logged sets', () => {
    const id = s().startSession(DATE, 'pull', NAMES)
    s().upsertSessionSets({
      sessionId: id,
      date: DATE,
      exerciseName: 'Bench',
      sets: [{ weightKg: 60, reps: 8, kind: 'working' }],
    })

    s().discardSession()

    expect(s().activeSession).toBeUndefined()
    expect(s().strengthLog).toHaveLength(1)
  })
})

describe('upsertSessionSets', () => {
  it('creates one entry and then updates it in place', () => {
    const id = s().startSession(DATE, 'pull', NAMES)

    const entryId = s().upsertSessionSets({
      sessionId: id,
      date: DATE,
      exerciseName: 'Bench',
      sets: [{ weightKg: 30, reps: 10, kind: 'warmup' }],
    })
    expect(s().strengthLog).toHaveLength(1)

    const sameId = s().upsertSessionSets({
      sessionId: id,
      date: DATE,
      exerciseName: 'Bench',
      sets: [
        { weightKg: 30, reps: 10, kind: 'warmup' },
        { weightKg: 60, reps: 8, kind: 'working' },
      ],
    })

    expect(sameId).toBe(entryId)
    expect(s().strengthLog).toHaveLength(1)
    expect(s().strengthLog[0]?.sets).toHaveLength(2)
    expect(s().strengthLog[0]?.updatedAt).toBeTruthy()
  })

  it('stamps every set with an id and keeps ids across updates', () => {
    const id = s().startSession(DATE, 'pull', NAMES)
    s().upsertSessionSets({
      sessionId: id,
      date: DATE,
      exerciseName: 'Bench',
      sets: [{ weightKg: 30, reps: 10, kind: 'warmup' }],
    })

    const first = s().strengthLog[0]?.sets[0]
    expect(first?.id).toBeTruthy()

    s().upsertSessionSets({
      sessionId: id,
      date: DATE,
      exerciseName: 'Bench',
      sets: [{ ...first!, reps: 12 }],
    })

    expect(s().strengthLog[0]?.sets[0]?.id).toBe(first?.id)
    expect(s().strengthLog[0]?.sets[0]?.reps).toBe(12)
  })

  it('keeps a separate entry per exercise', () => {
    const id = s().startSession(DATE, 'pull', NAMES)
    s().upsertSessionSets({
      sessionId: id,
      date: DATE,
      exerciseName: 'Bench',
      sets: [{ weightKg: 60, reps: 8 }],
    })
    s().upsertSessionSets({
      sessionId: id,
      date: DATE,
      exerciseName: 'Row',
      sets: [{ weightKg: 50, reps: 10 }],
    })

    expect(s().strengthLog).toHaveLength(2)
  })

  it('never marks the workout complete on its own', () => {
    const id = s().startSession(DATE, 'pull', NAMES)

    s().upsertSessionSets({
      sessionId: id,
      date: DATE,
      exerciseName: 'Bench',
      sets: [{ weightKg: 60, reps: 8, kind: 'working' }],
    })

    expect(s().checklist[DATE]?.items.completedWorkout).toBeUndefined()
  })

  it('removes the entry when the last set is deleted', () => {
    const id = s().startSession(DATE, 'pull', NAMES)
    s().upsertSessionSets({
      sessionId: id,
      date: DATE,
      exerciseName: 'Bench',
      sets: [{ weightKg: 60, reps: 8 }],
    })

    const result = s().upsertSessionSets({
      sessionId: id,
      date: DATE,
      exerciseName: 'Bench',
      sets: [],
    })

    expect(result).toBeUndefined()
    expect(s().strengthLog).toHaveLength(0)
  })

  it('never touches an ad-hoc entry that has no sessionId', () => {
    s().addStrengthEntry({
      date: DATE,
      exerciseName: 'Bench',
      sets: [{ weightKg: 45, reps: 12 }],
    })
    const id = s().startSession(DATE, 'pull', NAMES)

    s().upsertSessionSets({
      sessionId: id,
      date: DATE,
      exerciseName: 'Bench',
      sets: [{ weightKg: 60, reps: 8, kind: 'working' }],
    })
    s().upsertSessionSets({
      sessionId: id,
      date: DATE,
      exerciseName: 'Bench',
      sets: [],
    })

    const legacy = s().strengthLog.filter((e) => !e.sessionId)
    expect(legacy).toHaveLength(1)
    expect(legacy[0]?.sets).toEqual([{ weightKg: 45, reps: 12 }])
  })
})

describe('workout completion', () => {
  function logSet(sessionId: string, exerciseName: string, kind: 'warmup' | 'working') {
    s().upsertSessionSets({
      sessionId,
      date: DATE,
      exerciseName,
      sets: [{ weightKg: 60, reps: 8, kind }],
    })
  }

  it('completes on finishSession when at least one working set was saved', () => {
    const id = s().startSession(DATE, 'pull', NAMES)
    logSet(id, 'Bench', 'working')

    expect(s().finishSession()).toBe(true)
    expect(s().checklist[DATE]?.items.completedWorkout).toBe(true)
    expect(s().activeSession).toBeUndefined()
  })

  it('counts a legacy set with no kind as a working set', () => {
    const id = s().startSession(DATE, 'pull', NAMES)
    s().upsertSessionSets({
      sessionId: id,
      date: DATE,
      exerciseName: 'Bench',
      sets: [{ weightKg: 60, reps: 8 }],
    })

    expect(s().finishSession()).toBe(true)
    expect(s().checklist[DATE]?.items.completedWorkout).toBe(true)
  })

  it('does not complete a warmup-only session', () => {
    const id = s().startSession(DATE, 'pull', NAMES)
    logSet(id, 'Bench', 'warmup')

    expect(s().finishSession()).toBe(false)
    expect(s().checklist[DATE]?.items.completedWorkout).toBeUndefined()
  })

  it('does not complete an empty session', () => {
    s().startSession(DATE, 'pull', NAMES)

    expect(s().finishSession()).toBe(false)
    expect(s().checklist[DATE]).toBeUndefined()
  })

  it('does not complete a session whose every exercise was skipped', () => {
    const id = s().startSession(DATE, 'pull', NAMES)
    logSet(id, 'Bench', 'working')
    // The user then deletes the only set again before finishing.
    s().upsertSessionSets({ sessionId: id, date: DATE, exerciseName: 'Bench', sets: [] })

    expect(s().finishSession()).toBe(false)
    expect(s().checklist[DATE]?.items.completedWorkout).toBeUndefined()
  })

  it('ignores sets belonging to a different session', () => {
    const other = s().startSession(DATE, 'pull', NAMES)
    logSet(other, 'Bench', 'working')
    s().discardSession()

    s().startSession(DATE, 'pull', NAMES)
    expect(s().finishSession()).toBe(false)
    expect(s().checklist[DATE]?.items.completedWorkout).toBeUndefined()
  })

  it('discardSession never completes the workout', () => {
    const id = s().startSession(DATE, 'pull', NAMES)
    logSet(id, 'Bench', 'working')

    s().discardSession()

    expect(s().checklist[DATE]?.items.completedWorkout).toBeUndefined()
    expect(s().strengthLog).toHaveLength(1)
  })

  it('leaves a manual tick alone when the session does not qualify', () => {
    s().setChecklistItem(DATE, 'completedWorkout', true)
    const id = s().startSession(DATE, 'pull', NAMES)
    logSet(id, 'Bench', 'warmup')

    expect(s().finishSession()).toBe(false)
    expect(s().checklist[DATE]?.items.completedWorkout).toBe(true)
  })

  it('finishSession without an active session is a no-op', () => {
    expect(s().finishSession()).toBe(false)
    expect(s().checklist[DATE]).toBeUndefined()
  })

  it('keeps the ad-hoc addStrengthEntry completion behaviour', () => {
    s().addStrengthEntry({ date: DATE, exerciseName: 'Bench', sets: [{ weightKg: 60, reps: 8 }] })
    expect(s().checklist[DATE]?.items.completedWorkout).toBe(true)
  })

  it('keeps the addRunEntry completion behaviour', () => {
    s().addRunEntry({ date: DATE, distanceKm: 5 })
    expect(s().checklist[DATE]?.items.completedWorkout).toBe(true)
  })
})

describe('addSessionExercise', () => {
  it('appends a new exercise name', () => {
    s().startSession(DATE, 'pull', NAMES)
    s().addSessionExercise('Face Pull')
    expect(s().activeSession?.exerciseNames).toEqual([...NAMES, 'Face Pull'])
  })

  it('ignores a name that is already listed', () => {
    s().startSession(DATE, 'pull', NAMES)
    s().addSessionExercise('Row')
    expect(s().activeSession?.exerciseNames).toEqual(NAMES)
  })

  it('is a no-op without a running session', () => {
    s().addSessionExercise('Face Pull')
    expect(s().activeSession).toBeUndefined()
  })

  it('does not move currentIndex, and setSessionIndex can then reach the new exercise', () => {
    s().startSession(DATE, 'pull', NAMES)
    s().setSessionIndex(1)
    s().addSessionExercise('Face Pull')
    expect(s().activeSession?.currentIndex).toBe(1)

    s().setSessionIndex(3)
    expect(s().activeSession?.currentIndex).toBe(3)
    expect(s().activeSession?.exerciseNames[3]).toBe('Face Pull')
  })

  it('lets a free session started with no exercises grow', () => {
    s().startSession(DATE, 'free', [])
    expect(s().activeSession?.exerciseNames).toEqual([])

    s().addSessionExercise('Bench')
    s().addSessionExercise('Dip')
    expect(s().activeSession).toMatchObject({
      planSessionId: 'free',
      exerciseNames: ['Bench', 'Dip'],
      currentIndex: 0,
    })
  })
})

describe('updateStrengthEntry inside a running session', () => {
  it('moving an entry of the running session does not tick the new date', () => {
    const NEW = '2026-08-04'
    const id = s().startSession(DATE, 'pull', NAMES)
    const entryId = s().upsertSessionSets({
      sessionId: id,
      date: DATE,
      exerciseName: 'Bench',
      sets: [{ weightKg: 60, reps: 8, kind: 'working' }],
    })

    expect(s().updateStrengthEntry(entryId!, { date: NEW })).toBe(true)

    expect(s().strengthLog[0]?.date).toBe(NEW)
    expect(s().checklist[NEW]?.items.completedWorkout).toBeUndefined()
    expect(s().checklist[DATE]?.items.completedWorkout).toBeUndefined()

    // finishSession still decides, and it ticks the session's own date.
    expect(s().finishSession()).toBe(true)
    expect(s().checklist[DATE]?.items.completedWorkout).toBe(true)
  })
})

describe('backwards compatibility with persisted v1 data', () => {
  it('rehydrates entries that predate set kinds, session ids and the cursor into v3', async () => {
    localStorage.setItem(
      'cengo-cut',
      JSON.stringify({
        state: {
          settings: { programStartDate: '2026-07-27' },
          checklist: {},
          checkIns: {},
          strengthLog: [
            {
              id: 'old-1',
              date: '2026-07-28',
              exerciseName: 'Bench',
              sets: [{ weightKg: 50, reps: 8, rpe: 9 }],
              createdAt: '2026-07-28T18:00:00.000Z',
            },
          ],
          runLog: [],
          _schemaVersion: 1,
        },
        version: 1,
      }),
    )

    await useStore.persist.rehydrate()

    const old = s().strengthLog[0]
    expect(old?.id).toBe('old-1')
    expect(old?.sessionId).toBeUndefined()
    expect(old?.sets[0]).toEqual({ weightKg: 50, reps: 8, rpe: 9 })
    expect(setKind(old!.sets[0]!)).toBe('working')
    expect(s().activeSession).toBeUndefined()
    expect(SCHEMA_VERSION).toBe(3)
    expect(s()._schemaVersion).toBe(3)
  })
})
