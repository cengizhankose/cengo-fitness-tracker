import { describe, it, expect } from 'vitest'
import { set } from 'idb-keyval'
import { mergePulled } from './pullMerge'
import { makeState, populatedState } from '@/test/fixtures'

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
    await set('photo:2026-08-03:front', new Blob(['x']))
    const local = populatedState()
    const next = await mergePulled(local, {
      checkIns: {
        '2026-08-03': {
          date: '2026-08-03',
          weightKg: 89,
          createdAt: '2026-08-03T07:00:00.000Z',
          updatedAt: '2026-08-04T00:00:00.000Z', // newer than local's 07:00
        },
      },
    })
    expect(next.checkIns['2026-08-03']?.weightKg).toBe(89)
    expect(next.checkIns['2026-08-03']?.frontPhotoKey).toBe('photo:2026-08-03:front')
  })

  it('unions strengthLog by id, adding a new incoming entry', async () => {
    const local = populatedState()
    const next = await mergePulled(local, {
      strengthLog: [
        {
          id: 's2',
          date: '2026-08-04',
          exerciseName: 'Squat',
          sets: [{ weightKg: 100, reps: 5 }],
          createdAt: '2026-08-04T18:00:00.000Z',
        },
      ],
    })
    expect(next.strengthLog.map((e) => e.id).sort()).toEqual(['s1', 's2'])
  })

  it('takes a newer incoming benchmark', async () => {
    const local = populatedState()
    const next = await mergePulled(local, {
      benchmark: {
        date: '2026-08-20',
        timeSec: 1300,
        createdAt: '2026-08-20T09:00:00.000Z',
      },
    })
    expect(next.benchmark?.timeSec).toBe(1300)
  })

  it('never touches settings or activeSession', async () => {
    const local = makeState({ settings: { programStartDate: '2026-08-03' } })
    const next = await mergePulled(local, {})
    expect(next.settings).toEqual(local.settings)
    expect(next.activeSession).toBeUndefined()
  })
})
