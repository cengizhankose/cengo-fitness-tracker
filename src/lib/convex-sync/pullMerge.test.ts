import { describe, it, expect } from 'vitest'
import { set } from 'idb-keyval'
import { mergePulled } from './pullMerge'
import { makeState, populatedState } from '@/test/fixtures'
import type { StrengthLogEntry } from '@/types/userData'

describe('mergePulled', () => {
  it('takes a newer incoming checklist record over an older local one', async () => {
    const local = makeState({
      checklist: {
        '2026-08-03': {
          date: '2026-08-03',
          items: { completedWorkout: false },
          updatedAt: '2026-08-03T08:00:00.000Z',
        },
      },
    })
    const next = await mergePulled(local, {
      checklist: {
        '2026-08-03': {
          date: '2026-08-03',
          items: { completedWorkout: true },
          updatedAt: '2026-08-03T20:00:00.000Z',
        },
      },
    })
    expect(next.checklist['2026-08-03']?.items.completedWorkout).toBe(true)
  })

  it('ignores an older incoming checklist record', async () => {
    const local = makeState({
      checklist: {
        '2026-08-03': {
          date: '2026-08-03',
          items: { completedWorkout: true },
          updatedAt: '2026-08-03T20:00:00.000Z',
        },
      },
    })
    const next = await mergePulled(local, {
      checklist: {
        '2026-08-03': {
          date: '2026-08-03',
          items: { completedWorkout: false },
          updatedAt: '2026-08-03T08:00:00.000Z',
        },
      },
    })
    expect(next.checklist['2026-08-03']?.items.completedWorkout).toBe(true)
  })

  it('keeps the local checkIn photo keys even when a newer incoming record wins the other fields', async () => {
    await set('photo:2026-11-16:front', new Blob(['x']))
    await set('photo:2026-11-16:side', new Blob(['y']))
    const local = populatedState()
    const next = await mergePulled(local, {
      checkIns: {
        '2026-11-16': {
          date: '2026-11-16',
          weightKg: 94.8,
          createdAt: '2026-11-16T06:30:00.000Z',
          updatedAt: '2026-11-17T00:00:00.000Z', // newer than local's 06:30
        },
      },
    })
    expect(next.checkIns['2026-11-16']?.weightKg).toBe(94.8)
    expect(next.checkIns['2026-11-16']?.frontPhotoKey).toBe('photo:2026-11-16:front')
    expect(next.checkIns['2026-11-16']?.sidePhotoKey).toBe('photo:2026-11-16:side')
  })

  it('unions strengthLog by id, adding a new incoming entry', async () => {
    const local = populatedState()
    const next = await mergePulled(local, {
      strengthLog: [
        {
          id: 's3',
          date: '2026-11-17',
          exerciseName: 'Squat',
          sets: [{ weightKg: 100, reps: 5 }],
          createdAt: '2026-11-17T18:00:00.000Z',
        },
      ],
    })
    expect(next.strengthLog.map((e) => e.id).sort()).toEqual(['s1', 's2', 's3'])
  })

  it('replaces a local strength entry with a pulled edit of the same id carrying a newer updatedAt', async () => {
    const local = populatedState()
    const localS2 = local.strengthLog.find((e) => e.id === 's2') as StrengthLogEntry
    // what updateStrengthEntry on another device produces: same id, new sets, bumped updatedAt
    const edited: StrengthLogEntry = {
      ...localS2,
      sets: [{ id: 'set-2', weightKg: 125, reps: 5, rpe: 9, kind: 'working' }],
      progressionNote: 'add 2.5 kg',
      updatedAt: '2026-11-16T20:00:00.000Z',
    }
    const next = await mergePulled(local, { strengthLog: [edited] })
    expect(next.strengthLog.filter((e) => e.id === 's2')).toEqual([edited])
    expect(next.strengthLog).toHaveLength(2)
  })

  it('keeps the local strength entry when the pulled copy of the same id is older', async () => {
    const local = populatedState()
    const localS2 = local.strengthLog.find((e) => e.id === 's2') as StrengthLogEntry
    const stale: StrengthLogEntry = {
      ...localS2,
      sets: [{ id: 'set-2', weightKg: 100, reps: 5, kind: 'working' }],
      updatedAt: '2026-11-16T07:21:00.000Z', // older than local's 07:25
    }
    const next = await mergePulled(local, { strengthLog: [stale] })
    expect(next.strengthLog.find((e) => e.id === 's2')).toEqual(localS2)
  })

  it('never touches settings or activeSession', async () => {
    const activeSession = {
      id: 'session-1',
      date: '2026-11-16',
      planSessionId: 'w1-mon-strength',
      exerciseNames: ['Deadlift', 'Pull Up / Lat Pulldown'],
      currentIndex: 1,
      startedAt: '2026-11-16T07:00:00.000Z',
    }
    const local = makeState({ activeSession })
    const next = await mergePulled(local, {})
    expect(next.settings).toEqual(local.settings)
    expect(next.activeSession).toEqual(activeSession)
  })
})
