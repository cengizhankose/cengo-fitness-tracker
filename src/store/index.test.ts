import { beforeEach, describe, expect, it, vi } from 'vitest'
import { migrateState, useStore, type PersistedState } from '@/store'
import { addDays, toLocalISODate } from '@/lib/dates'
import { legacyState } from '@/test/fixtures'
import type { DailyChecklistRecord, IsoDate, StrengthLogEntry } from '@/types/userData'

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
    state().toggleChecklistItem(today, 'hitProteinTarget')
    const id = logStrength(today)
    state().removeStrengthEntry(id)
    expect(record(today)?.items.hitProteinTarget).toBe(true)
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
    state().toggleChecklistItem(today, 'inBedByMidnight')
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
})

describe('migrateState (v1/v2 -> v3)', () => {
  const versions = [1, 2] as const

  for (const v of versions) {
    it(`v${v}: bumps the version and drops retired slices`, () => {
      const input = legacyState(v)
      const next = migrateState(input, v)
      expect(next._schemaVersion).toBe(3)
      expect(next).not.toHaveProperty('marathonStatus')
      expect(next).not.toHaveProperty('benchmark')
      expect(next).not.toHaveProperty('activeSession')
    })

    it(`v${v}: keeps every user slice as the very same reference`, () => {
      const input = legacyState(v)
      const next = migrateState(input, v)
      expect(next.settings).toBe(input.settings)
      expect(next.checklist).toBe(input.checklist)
      expect(next.checkIns).toBe(input.checkIns)
      expect(next.strengthLog).toBe(input.strengthLog)
      expect(next.runLog).toBe(input.runLog)
    })

    it(`v${v}: preserves legacy checklist keys verbatim and never invents autoWorkout`, () => {
      const next = migrateState(legacyState(v), v)
      expect(next.checklist['2026-08-03']?.items).toEqual({
        completedWorkout: true,
        noAlcohol: true,
        completedMorningMobility: false,
      })
      expect(next.checklist['2026-08-04']?.items).toEqual({
        hitCalorieTarget: true,
        steps10000Plus: true,
        sleep75Plus: true,
      })
      for (const rec of Object.values(next.checklist)) {
        expect(rec).not.toHaveProperty('autoWorkout')
      }
    })
  }

  it('returns v3 input as-is', () => {
    const input = { ...legacyState(2), _schemaVersion: 3 } as unknown as PersistedState
    expect(migrateState(input, 3)).toBe(input)
  })
})

describe('legacy data rehydrated through the persist middleware', () => {
  const DAY: IsoDate = '2026-08-03'

  for (const v of [1, 2] as const) {
    describe(`v${v} envelope`, () => {
      beforeEach(async () => {
        localStorage.setItem('cengo-cut', JSON.stringify({ state: legacyState(v), version: v }))
        await useStore.persist.rehydrate()
      })

      it('migrates to schema 3 and drops retired slices', () => {
        expect(state()._schemaVersion).toBe(3)
        expect(state().activeSession).toBeUndefined()
        expect(state()).not.toHaveProperty('marathonStatus')
        expect(state()).not.toHaveProperty('benchmark')
      })

      it('keeps legacy checklist keys without inventing provenance', () => {
        expect(ticked(DAY)).toBe(true)
        expect(record(DAY)?.autoWorkout).toBeUndefined()
        expect(record(DAY)?.items.noAlcohol).toBe(true)
        expect(record('2026-08-04')?.items.sleep75Plus).toBe(true)
        expect(state().strengthLog).toHaveLength(1)
      })

      it("keeps the legacy tick when the day's last legacy log is deleted", () => {
        state().removeStrengthEntry('legacy-s1')

        expect(state().strengthLog).toHaveLength(0)
        expect(ticked(DAY)).toBe(true) // manual-by-default: never revoked
        expect(record(DAY)?.items.noAlcohol).toBe(true)
      })
    })
  }
})

describe('updateStrengthEntry', () => {
  const OLD: IsoDate = '2026-11-16'
  const NEW: IsoDate = '2026-11-17'
  const entry = (id: string) => state().strengthLog.find((e) => e.id === id)

  it('reverts the old date auto-tick when no log remains there and ticks the new date', () => {
    const id = logStrength(OLD)
    expect(state().updateStrengthEntry(id, { date: NEW })).toBe(true)

    expect(entry(id)?.date).toBe(NEW)
    expect(ticked(OLD)).toBe(false)
    expect(record(OLD)?.autoWorkout).toBeUndefined()
    expect(ticked(NEW)).toBe(true)
    expect(record(NEW)?.autoWorkout).toBe(true)
  })

  it('keeps the old date ticked while another log remains there', () => {
    const id = logStrength(OLD, 'Squat')
    logStrength(OLD, 'Bench')
    state().updateStrengthEntry(id, { date: NEW })

    expect(ticked(OLD)).toBe(true)
    expect(record(OLD)?.autoWorkout).toBe(true)
    expect(ticked(NEW)).toBe(true)
  })

  it('leaves a manual tick on the old date alone', () => {
    state().setChecklistItem(OLD, 'completedWorkout', true)
    const id = logStrength(OLD)
    state().updateStrengthEntry(id, { date: NEW })

    expect(ticked(OLD)).toBe(true)
    expect(record(OLD)?.autoWorkout).toBeUndefined()
    expect(record(NEW)?.autoWorkout).toBe(true)
  })

  it('a same-date set edit bumps updatedAt, keeps id/createdAt, stamps set ids and spares the checklist', () => {
    const id = logStrength(OLD)
    const before = entry(id)!
    const checklist = state().checklist

    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2030-01-01T00:00:00.000Z'))
    state().updateStrengthEntry(id, {
      sets: [
        { weightKg: 105, reps: 5 },
        { id: 'keep-me', weightKg: 110, reps: 3 },
      ],
    })

    const after = entry(id)!
    expect(after.id).toBe(id)
    expect(after.createdAt).toBe(before.createdAt)
    expect(after.updatedAt).toBe('2030-01-01T00:00:00.000Z')
    expect(after.sets).toHaveLength(2)
    expect(after.sets[0]?.id).toBeTruthy()
    expect(after.sets[0]?.weightKg).toBe(105)
    expect(after.sets[1]?.id).toBe('keep-me')
    expect(state().checklist).toBe(checklist)
  })

  it('edits exerciseName and progressionNote, and an empty note clears it', () => {
    const id = logStrength(OLD)
    state().updateStrengthEntry(id, { exerciseName: 'Front Squat', progressionNote: '+2.5kg' })
    expect(entry(id)?.exerciseName).toBe('Front Squat')
    expect(entry(id)?.progressionNote).toBe('+2.5kg')

    state().updateStrengthEntry(id, { progressionNote: '' })
    expect(entry(id)).not.toHaveProperty('progressionNote')
    expect(entry(id)?.exerciseName).toBe('Front Squat')
  })

  it('empty sets removes the entry and reverts the auto-tick', () => {
    const id = logStrength(OLD)
    expect(state().updateStrengthEntry(id, { sets: [] })).toBe(true)
    expect(entry(id)).toBeUndefined()
    expect(ticked(OLD)).toBe(false)
  })

  it('returns false for an unknown id and changes nothing', () => {
    logStrength(OLD)
    const log: StrengthLogEntry[] = state().strengthLog
    const checklist: Record<IsoDate, DailyChecklistRecord> = state().checklist
    expect(state().updateStrengthEntry('nope', { date: NEW, sets: [] })).toBe(false)
    expect(state().strengthLog).toBe(log)
    expect(state().checklist).toBe(checklist)
  })
})

describe('saveCheckIn', () => {
  it('stores a non-Monday date under exactly that key and merges later saves', () => {
    const WED: IsoDate = '2026-11-18'
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-18T06:00:00.000Z'))
    state().saveCheckIn({ date: WED, weightKg: 95.1 })

    expect(Object.keys(state().checkIns)).toEqual([WED])
    const first = state().checkIns[WED]!
    expect(first.date).toBe(WED)

    vi.setSystemTime(new Date('2026-11-18T07:00:00.000Z'))
    state().saveCheckIn({ date: WED, waistCm: 100 })

    const second = state().checkIns[WED]!
    expect(second).toMatchObject({ date: WED, weightKg: 95.1, waistCm: 100 })
    expect(second.createdAt).toBe(first.createdAt)
    expect(second.updatedAt).toBe('2026-11-18T07:00:00.000Z')
    expect(second.updatedAt).not.toBe(first.updatedAt)
  })
})
