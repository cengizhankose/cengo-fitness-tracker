import { beforeEach, describe, expect, it } from 'vitest'
import { migrateState, useStore, type PersistedState } from '@/store'
import { addDays, toLocalISODate } from '@/lib/dates'
import type { IsoDate } from '@/types/userData'

const today: IsoDate = toLocalISODate()

const state = () => useStore.getState()
const record = (date: IsoDate) => state().checklist[date]
const ticked = (date: IsoDate) => record(date)?.items.completedWorkout

const logStrength = (date: IsoDate, exerciseName = 'Squat') =>
  state().addStrengthEntry({ date, exerciseName, sets: [{ weightKg: 100, reps: 5 }] })

const logRun = (date: IsoDate, distanceKm = 5) => state().addRunEntry({ date, distanceKm })

beforeEach(() => {
  state().resetAll()
})

describe('auto-tick on log', () => {
  it('ticks the workout box and records that we set it', () => {
    logStrength(today)
    expect(ticked(today)).toBe(true)
    expect(record(today)?.autoWorkout).toBe(true)
  })

  it('leaves an already-ticked box alone, so a manual tick stays manual', () => {
    state().toggleChecklistItem(today, 'completedWorkout')
    logStrength(today)
    expect(ticked(today)).toBe(true)
    expect(record(today)?.autoWorkout).toBeUndefined()
  })
})

describe('removing the last log of a date', () => {
  it('reverts the auto-tick for a strength entry', () => {
    const id = logStrength(today)
    state().removeStrengthEntry(id)
    expect(state().strengthLog).toHaveLength(0)
    expect(ticked(today)).toBe(false)
    expect(record(today)?.autoWorkout).toBeUndefined()
  })

  it('reverts the auto-tick for a run entry', () => {
    const id = logRun(today)
    state().removeRunEntry(id)
    expect(state().runLog).toHaveLength(0)
    expect(ticked(today)).toBe(false)
    expect(record(today)?.autoWorkout).toBeUndefined()
  })

  it('keeps other checklist items on the day intact', () => {
    state().toggleChecklistItem(today, 'noAlcohol')
    const id = logStrength(today)
    state().removeStrengthEntry(id)
    expect(record(today)?.items.noAlcohol).toBe(true)
    expect(ticked(today)).toBe(false)
  })
})

describe('other logs on the same date hold the tick', () => {
  it('keeps it while a second strength entry remains', () => {
    const first = logStrength(today, 'Squat')
    logStrength(today, 'Bench')
    state().removeStrengthEntry(first)
    expect(ticked(today)).toBe(true)
    expect(record(today)?.autoWorkout).toBe(true)

    state().removeStrengthEntry(state().strengthLog[0]!.id)
    expect(ticked(today)).toBe(false)
  })

  it('keeps it while a run on the same day remains', () => {
    const strengthId = logStrength(today)
    const runId = logRun(today)

    state().removeStrengthEntry(strengthId)
    expect(ticked(today)).toBe(true)

    state().removeRunEntry(runId)
    expect(ticked(today)).toBe(false)
  })
})

describe('date scoping', () => {
  it('only clears the date the deleted entry belonged to', () => {
    const yesterday = addDays(today, -1)
    const yesterdayId = logStrength(yesterday)
    logStrength(today)

    state().removeStrengthEntry(yesterdayId)

    expect(ticked(yesterday)).toBe(false)
    expect(ticked(today)).toBe(true)
  })

  it('handles a backdated entry without touching today', () => {
    const past = addDays(today, -5)
    const pastId = logRun(past)
    logRun(today)

    state().removeRunEntry(pastId)

    expect(ticked(past)).toBe(false)
    expect(ticked(today)).toBe(true)
    expect(state().runLog).toHaveLength(1)
  })
})

describe('manual vs automatic ownership', () => {
  it('preserves a tick the user set before logging', () => {
    state().toggleChecklistItem(today, 'completedWorkout')
    const id = logStrength(today)
    state().removeStrengthEntry(id)
    expect(ticked(today)).toBe(true)
  })

  it('preserves a tick the user re-affirmed after logging', () => {
    const id = logStrength(today)
    state().toggleChecklistItem(today, 'completedWorkout') // off
    state().toggleChecklistItem(today, 'completedWorkout') // on — now the user's
    expect(record(today)?.autoWorkout).toBeUndefined()

    state().removeStrengthEntry(id)
    expect(ticked(today)).toBe(true)
  })

  it('leaves a manually cleared box cleared', () => {
    const id = logStrength(today)
    state().toggleChecklistItem(today, 'completedWorkout')
    expect(ticked(today)).toBe(false)

    state().removeStrengthEntry(id)
    expect(ticked(today)).toBe(false)
  })

  it('does not disturb provenance when another checklist key is toggled', () => {
    const id = logStrength(today)
    state().toggleChecklistItem(today, 'sleep75Plus')
    expect(record(today)?.autoWorkout).toBe(true)

    state().removeStrengthEntry(id)
    expect(ticked(today)).toBe(false)
  })

  it('setChecklistItem also transfers ownership to the user', () => {
    const id = logStrength(today)
    state().setChecklistItem(today, 'completedWorkout', true)
    state().removeStrengthEntry(id)
    expect(ticked(today)).toBe(true)
  })
})

describe('edge cases', () => {
  it('is a no-op for an unknown id', () => {
    logStrength(today)
    const before = state().checklist
    state().removeStrengthEntry('does-not-exist')
    state().removeRunEntry('does-not-exist')
    expect(state().strengthLog).toHaveLength(1)
    expect(state().checklist).toBe(before)
  })

  it('does not let a benchmark hold the tick — the run entry is the workout record', () => {
    const runId = logRun(today, 5)
    useStore.setState({
      benchmark: {
        date: today,
        timeSec: 1500,
        averagePace: '5:00/km',
        createdAt: new Date().toISOString(),
      },
    })

    state().removeRunEntry(runId)

    expect(ticked(today)).toBe(false)
    expect(state().benchmark).toBeDefined()
  })
})

describe('migrateState (v1 -> v2)', () => {
  const base = (checklist: PersistedState['checklist']): PersistedState => ({
    settings: { programStartDate: '2026-01-05' },
    checklist,
    checkIns: {},
    strengthLog: [
      {
        id: 's1',
        date: '2026-01-06',
        exerciseName: 'Squat',
        sets: [{ weightKg: 100, reps: 5 }],
        createdAt: '2026-01-06T10:00:00.000Z',
      },
    ],
    runLog: [],
    benchmark: undefined,
    marathonStatus: {},
    _schemaVersion: 1,
  })

  const legacy = base({
    '2026-01-06': {
      date: '2026-01-06',
      items: { completedWorkout: true, noAlcohol: true },
      updatedAt: '2026-01-06T10:00:00.000Z',
    },
    '2026-01-07': {
      date: '2026-01-07',
      items: { completedWorkout: true },
      updatedAt: '2026-01-07T10:00:00.000Z',
    },
    '2026-01-08': {
      date: '2026-01-08',
      items: { completedWorkout: false, sleep75Plus: true },
      updatedAt: '2026-01-08T10:00:00.000Z',
    },
  })

  it('never infers automatic provenance — a same-day log does not prove the tick was automatic', () => {
    const next = migrateState(legacy, 1)
    // 2026-01-06 is ticked AND has a strength log, yet stays user-owned: v1 cannot tell us who
    // set the tick, so revoking it later would risk destroying a manual one.
    expect(next.checklist['2026-01-06']?.autoWorkout).toBeUndefined()
    expect(next.checklist['2026-01-07']?.autoWorkout).toBeUndefined()
    expect(next.checklist['2026-01-08']?.autoWorkout).toBeUndefined()
  })

  it('preserves every existing item and log, and bumps the version', () => {
    const next = migrateState(legacy, 1)
    expect(next.checklist).toEqual(legacy.checklist)
    expect(next.checklist['2026-01-06']?.items).toEqual({
      completedWorkout: true,
      noAlcohol: true,
    })
    expect(next.strengthLog).toEqual(legacy.strengthLog)
    expect(next.checkIns).toEqual(legacy.checkIns)
    expect(next.settings).toEqual(legacy.settings)
    expect(next._schemaVersion).toBe(2)
  })

  it('is a no-op once already on v2', () => {
    const next = migrateState(legacy, 2)
    expect(next).toBe(legacy)
  })
})

describe('legacy v1 data rehydrated through the persist middleware', () => {
  const DAY: IsoDate = '2026-01-06'

  /** A real localStorage envelope as written by the shipped v1 build. */
  const v1Envelope = JSON.stringify({
    version: 1,
    state: {
      settings: { programStartDate: '2026-01-05' },
      checklist: {
        [DAY]: {
          date: DAY,
          // The user ticked this by hand. v1 stored no provenance to say so.
          items: { completedWorkout: true, noAlcohol: true },
          updatedAt: '2026-01-06T09:00:00.000Z',
        },
      },
      checkIns: {},
      strengthLog: [
        {
          id: 'legacy-s1',
          date: DAY,
          exerciseName: 'Squat',
          sets: [{ weightKg: 100, reps: 5 }],
          createdAt: '2026-01-06T10:00:00.000Z',
        },
      ],
      runLog: [],
      _schemaVersion: 1,
    },
  })

  beforeEach(async () => {
    localStorage.setItem('cengo-cut', v1Envelope)
    await useStore.persist.rehydrate()
  })

  it('migrates without inventing provenance', () => {
    expect(state()._schemaVersion).toBe(2)
    expect(ticked(DAY)).toBe(true)
    expect(record(DAY)?.autoWorkout).toBeUndefined()
    expect(state().strengthLog).toHaveLength(1)
  })

  it("keeps the tick when the day's last legacy log is deleted", () => {
    state().removeStrengthEntry('legacy-s1')

    expect(state().strengthLog).toHaveLength(0)
    expect(ticked(DAY)).toBe(true) // manual-by-default: never revoked
    expect(record(DAY)?.items.noAlcohol).toBe(true)
  })
})
