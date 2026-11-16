import { describe, expect, it } from 'vitest'
import type { CheckIn, StrengthLogEntry } from '@/types/userData'
import { mergeState } from './merge'
import type { MergeOptions } from './merge'
import { validateBackup } from './validate'
import { legacyBackupDoc, legacyState, makeState, populatedState } from '@/test/fixtures'

const NO_PHOTOS: Pick<MergeOptions, 'localPhotoKeys' | 'filePhotoKeys'> = {
  localPhotoKeys: new Set(),
  filePhotoKeys: new Set(),
}

const TOKEN = 'tok0'

function opts(over: Partial<MergeOptions> = {}): MergeOptions {
  return { mode: 'merge', stageToken: TOKEN, ...NO_PHOTOS, ...over }
}

const strength = (id: string, weightKg: number, createdAt: string): StrengthLogEntry => ({
  id,
  date: '2026-08-03',
  exerciseName: 'Bench Press',
  sets: [{ weightKg, reps: 8 }],
  createdAt,
})

const checkIn = (over: Partial<CheckIn> = {}): CheckIn => ({
  date: '2026-08-03',
  createdAt: '2026-08-03T07:00:00.000Z',
  updatedAt: '2026-08-03T07:00:00.000Z',
  ...over,
})

describe('settings', () => {
  it('merge keeps the local settings', () => {
    const localSettings = {}
    const incomingSettings = {}
    const local = makeState({ settings: localSettings })
    const incoming = makeState({ settings: incomingSettings })
    expect(mergeState(local, incoming, opts()).next.settings).toBe(localSettings)
  })

  it('replace takes the incoming settings', () => {
    const localSettings = {}
    const incomingSettings = {}
    const local = makeState({ settings: localSettings })
    const incoming = makeState({ settings: incomingSettings })
    expect(mergeState(local, incoming, opts({ mode: 'replace' })).next.settings).toBe(
      incomingSettings,
    )
  })
})

describe('checklist', () => {
  const rec = (updatedAt: string, items: Record<string, boolean>) => ({
    '2026-08-03': { date: '2026-08-03', items, updatedAt },
  })

  it('takes the record with the later updatedAt', () => {
    const local = makeState({ checklist: rec('2026-08-03T10:00:00.000Z', { completedWorkout: true }) })
    const incoming = makeState({ checklist: rec('2026-08-03T18:00:00.000Z', { noAlcohol: true }) })
    const { next } = mergeState(local, incoming, opts())
    expect(next.checklist['2026-08-03']?.items).toEqual({ noAlcohol: true })
  })

  it('does not resurrect a deliberately unticked item', () => {
    const local = makeState({ checklist: rec('2026-08-03T18:00:00.000Z', { completedWorkout: false }) })
    const incoming = makeState({ checklist: rec('2026-08-03T10:00:00.000Z', { completedWorkout: true }) })
    const { next } = mergeState(local, incoming, opts())
    expect(next.checklist['2026-08-03']?.items.completedWorkout).toBe(false)
  })

  it('breaks an updatedAt tie toward more completed items', () => {
    const t = '2026-08-03T18:00:00.000Z'
    const local = makeState({ checklist: rec(t, { completedWorkout: true }) })
    const incoming = makeState({ checklist: rec(t, { completedWorkout: true, noAlcohol: true }) })
    const { next } = mergeState(local, incoming, opts())
    expect(Object.keys(next.checklist['2026-08-03']?.items ?? {})).toHaveLength(2)
  })

  it('keeps legacy checklist keys of whichever record wins', () => {
    const legacyItems = { completedWorkout: true, noAlcohol: true, steps10000Plus: false }
    const older = makeState({ checklist: rec('2026-08-03T10:00:00.000Z', { completedWorkout: true }) })
    const newerLegacy = makeState({ checklist: rec('2026-08-03T18:00:00.000Z', legacyItems) })
    expect(mergeState(older, newerLegacy, opts()).next.checklist['2026-08-03']?.items).toEqual(legacyItems)
    expect(mergeState(newerLegacy, older, opts()).next.checklist['2026-08-03']?.items).toEqual(legacyItems)
  })

  it('adds days the local state has never seen', () => {
    const local = makeState()
    const incoming = makeState({ checklist: rec('2026-08-03T18:00:00.000Z', { noAlcohol: true }) })
    const { next, report } = mergeState(local, incoming, opts())
    expect(Object.keys(next.checklist)).toEqual(['2026-08-03'])
    expect(report.added).toBe(1)
  })
})

describe('checkIns', () => {
  it('merges fields sparsely so the metric and photo write paths do not destroy each other', () => {
    // Local: photo attached later. Incoming: metrics saved earlier.
    const local = makeState({
      checkIns: {
        '2026-08-03': checkIn({
          frontPhotoKey: 'photo:2026-08-03:front',
          updatedAt: '2026-08-03T20:00:00.000Z',
        }),
      },
    })
    const incoming = makeState({
      checkIns: {
        '2026-08-03': checkIn({ weightKg: 91.2, waistCm: 94, updatedAt: '2026-08-03T09:00:00.000Z' }),
      },
    })
    const { next } = mergeState(local, incoming, opts({ localPhotoKeys: new Set(['photo:2026-08-03:front']) }))
    const merged = next.checkIns['2026-08-03']
    expect(merged?.frontPhotoKey).toBe('photo:2026-08-03:front')
    expect(merged?.weightKg).toBe(91.2)
    expect(merged?.waistCm).toBe(94)
  })

  it('keeps the earliest createdAt and the latest updatedAt', () => {
    const local = makeState({
      checkIns: {
        '2026-08-03': checkIn({
          createdAt: '2026-08-03T07:00:00.000Z',
          updatedAt: '2026-08-03T20:00:00.000Z',
        }),
      },
    })
    const incoming = makeState({
      checkIns: {
        '2026-08-03': checkIn({
          createdAt: '2026-08-01T07:00:00.000Z',
          updatedAt: '2026-08-02T07:00:00.000Z',
        }),
      },
    })
    const merged = mergeState(local, incoming, opts()).next.checkIns['2026-08-03']
    expect(merged?.createdAt).toBe('2026-08-01T07:00:00.000Z')
    expect(merged?.updatedAt).toBe('2026-08-03T20:00:00.000Z')
  })

  it('lets the newer record win a contested field', () => {
    const local = makeState({
      checkIns: { '2026-08-03': checkIn({ weightKg: 90, updatedAt: '2026-08-03T07:00:00.000Z' }) },
    })
    const incoming = makeState({
      checkIns: { '2026-08-03': checkIn({ weightKg: 88, updatedAt: '2026-08-04T07:00:00.000Z' }) },
    })
    expect(mergeState(local, incoming, opts()).next.checkIns['2026-08-03']?.weightKg).toBe(88)
  })
})

describe('strength / run logs', () => {
  it('unions by id', () => {
    const local = makeState({ strengthLog: [strength('a', 80, '2026-08-03T18:00:00.000Z')] })
    const incoming = makeState({ strengthLog: [strength('b', 82, '2026-08-05T18:00:00.000Z')] })
    const { next, report } = mergeState(local, incoming, opts())
    expect(next.strengthLog.map((e) => e.id)).toEqual(['b', 'a'])
    expect(report.idConflicts).toEqual([])
  })

  it('dedupes an identical entry silently', () => {
    const entry = strength('a', 80, '2026-08-03T18:00:00.000Z')
    const { next, report } = mergeState(
      makeState({ strengthLog: [entry] }),
      makeState({ strengthLog: [{ ...entry, sets: [...entry.sets] }] }),
      opts(),
    )
    expect(next.strengthLog).toHaveLength(1)
    expect(report.idConflicts).toEqual([])
  })

  it('keeps the local record when an id collides with different content', () => {
    const local = makeState({ strengthLog: [strength('a', 80, '2026-08-03T18:00:00.000Z')] })
    const incoming = makeState({ strengthLog: [strength('a', 100, '2026-08-03T18:00:00.000Z')] })
    const { next, report } = mergeState(local, incoming, opts())
    expect(next.strengthLog[0]?.sets[0]?.weightKg).toBe(80)
    expect(report.idConflicts).toEqual(['a'])
  })

  it('lets an incoming copy with a strictly newer updatedAt replace the local one', () => {
    const local = makeState({
      strengthLog: [{ ...strength('a', 80, '2026-08-03T18:00:00.000Z'), updatedAt: '2026-08-03T18:05:00.000Z' }],
    })
    const incoming = makeState({
      strengthLog: [{ ...strength('a', 100, '2026-08-03T18:00:00.000Z'), updatedAt: '2026-08-04T09:00:00.000Z' }],
    })
    const { next, report } = mergeState(local, incoming, opts())
    expect(next.strengthLog).toHaveLength(1)
    expect(next.strengthLog[0]?.sets[0]?.weightKg).toBe(100)
    expect(next.strengthLog[0]?.updatedAt).toBe('2026-08-04T09:00:00.000Z')
    expect(report.updated).toBe(1)
    expect(report.added).toBe(0)
    expect(report.idConflicts).toEqual([])
  })

  it('keeps local and reports the id when the incoming stamp is older or equal', () => {
    const localEntry = { ...strength('a', 80, '2026-08-03T18:00:00.000Z'), updatedAt: '2026-08-04T09:00:00.000Z' }
    const local = makeState({ strengthLog: [localEntry] })
    for (const updatedAt of ['2026-08-03T19:00:00.000Z', '2026-08-04T09:00:00.000Z']) {
      const incoming = makeState({
        strengthLog: [{ ...strength('a', 100, '2026-08-03T18:00:00.000Z'), updatedAt }],
      })
      const { next, report } = mergeState(local, incoming, opts())
      expect(next.strengthLog).toEqual([localEntry])
      expect(report.idConflicts).toEqual(['a'])
      expect(report.updated).toBe(0)
    }
  })

  it('treats a deep-equal copy with an updatedAt as a no-op', () => {
    const entry: StrengthLogEntry = {
      ...strength('a', 80, '2026-08-03T18:00:00.000Z'),
      sets: [{ id: 'x1', weightKg: 80, reps: 8, kind: 'working' }],
      sessionId: 'session-9',
      updatedAt: '2026-08-04T09:00:00.000Z',
    }
    const { next, report } = mergeState(
      makeState({ strengthLog: [entry] }),
      makeState({ strengthLog: [JSON.parse(JSON.stringify(entry)) as StrengthLogEntry] }),
      opts(),
    )
    expect(next.strengthLog).toEqual([entry])
    expect(next.strengthLog[0]).toBe(entry)
    expect(report).toMatchObject({ added: 0, updated: 0, removed: 0, idConflicts: [] })
  })

  it('sorts newest first, matching what the Log screen renders', () => {
    const local = makeState({ strengthLog: [strength('a', 80, '2026-08-01T10:00:00.000Z')] })
    const incoming = makeState({
      strengthLog: [
        strength('b', 82, '2026-08-05T10:00:00.000Z'),
        strength('c', 84, '2026-08-03T10:00:00.000Z'),
      ],
    })
    expect(mergeState(local, incoming, opts()).next.strengthLog.map((e) => e.id)).toEqual([
      'b',
      'c',
      'a',
    ])
  })
})

describe('replace mode', () => {
  it('swaps every collection and reports removals', () => {
    const local = populatedState()
    const incoming = makeState({
      runLog: [
        { id: 'r9', date: '2026-05-11', distanceKm: 5, createdAt: '2026-05-11T06:00:00.000Z' },
      ],
    })
    const { next, report } = mergeState(local, incoming, opts({ mode: 'replace' }))
    expect(next.strengthLog).toEqual([])
    expect(next.runLog.map((e) => e.id)).toEqual(['r9'])
    expect(report.added).toBe(1)
    // populatedState(): 2 checklist days, 2 check-ins, 2 strength entries, 1 run.
    expect(report.removed).toBe(7)
  })
})

describe('merge mode never deletes a local record', () => {
  it('keeps every local record when the incoming state is empty', () => {
    const local = populatedState()
    const { next, report } = mergeState(local, makeState(), opts({
      localPhotoKeys: new Set(['photo:2026-11-16:front', 'photo:2026-11-16:side']),
    }))
    expect(next).toEqual(local)
    expect(report.removed).toBe(0)
  })

  it('adds a validated v2 backup onto a populated local state and removes nothing', () => {
    const validated = validateBackup(legacyBackupDoc(2))
    if (!validated.ok) throw new Error(`legacy fixture did not validate: ${validated.error.code}`)
    const incoming = validated.value.state
    const legacy = legacyState(2)
    const local = populatedState()
    const { next, report } = mergeState(local, incoming, opts({
      localPhotoKeys: new Set(['photo:2026-11-16:front', 'photo:2026-11-16:side']),
    }))

    expect(report.removed).toBe(0)
    expect(report.idConflicts).toEqual([])
    // 2 checklist days, 1 check-in, 1 strength entry, 1 run.
    expect(report.added).toBe(5)
    expect(next.checklist).toEqual({ ...local.checklist, ...(legacy['checklist'] as object) })
    expect(next.checkIns).toEqual({ ...local.checkIns, ...(legacy['checkIns'] as object) })
    expect(next.strengthLog.map((e) => e.id).sort()).toEqual(['legacy-s1', 's1', 's2'])
    expect(next.runLog.map((e) => e.id).sort()).toEqual(['legacy-r1', 'r1'])
    for (const entry of local.strengthLog) expect(next.strengthLog).toContainEqual(entry)
    expect(next.settings).toBe(local.settings)
    expect(next.activeSession).toBeUndefined()
    expect('benchmark' in next).toBe(false)
    expect('marathonStatus' in next).toBe(false)
  })
})

describe('photos', () => {
  const withFront = (key: string, updatedAt: string) =>
    makeState({ checkIns: { '2026-08-03': checkIn({ frontPhotoKey: key, updatedAt }) } })

  it('stages the incoming blob under a fresh key when the incoming record wins', () => {
    const key = 'photo:2026-08-03:front'
    const { report, next } = mergeState(
      makeState(),
      withFront(key, '2026-08-03T09:00:00.000Z'),
      opts({ filePhotoKeys: new Set([key]) }),
    )
    expect(report.photoWrites).toEqual([{ from: key, to: `${key}#${TOKEN}-0` }])
    expect(next.checkIns['2026-08-03']?.frontPhotoKey).toBe(`${key}#${TOKEN}-0`)
  })

  /**
   * Sources that differ only by an existing `#token` reduce to the same base key.
   * Without a per-source index they would stage to the same destination and one
   * blob would silently overwrite the other. Local state is never schema-validated
   * (it comes straight from localStorage), so this is reachable in practice.
   */
  it('gives colliding source keys distinct destinations', () => {
    const bare = 'photo:2026-08-03:front'
    const tokened = 'photo:2026-08-03:front#abc'
    const local = makeState({
      checkIns: {
        '2026-08-03': checkIn({ frontPhotoKey: tokened, updatedAt: '2026-08-03T09:00:00.000Z' }),
        '2026-08-04': checkIn({
          date: '2026-08-04',
          frontPhotoKey: bare,
          updatedAt: '2026-08-04T09:00:00.000Z',
        }),
      },
    })
    const { next, report } = mergeState(
      local,
      makeState(),
      opts({ filePhotoKeys: new Set([bare, tokened]) }),
    )

    expect(report.photoWrites).toHaveLength(2)
    const destinations = report.photoWrites.map((w) => w.to)
    expect(new Set(destinations).size).toBe(2)
    expect(next.checkIns['2026-08-03']?.frontPhotoKey).not.toBe(
      next.checkIns['2026-08-04']?.frontPhotoKey,
    )
    // Each destination still carries its own source's identity, index and all.
    expect(destinations).toEqual([
      `photo:2026-08-03:front#${TOKEN}-0`,
      `photo:2026-08-03:front#${TOKEN}-1`,
    ])
  })

  it('reuses one destination when the same source key is referenced twice', () => {
    const key = 'photo:2026-08-03:front'
    const local = makeState({
      checkIns: {
        '2026-08-03': checkIn({ frontPhotoKey: key, updatedAt: '2026-08-03T09:00:00.000Z' }),
        '2026-08-04': checkIn({
          date: '2026-08-04',
          frontPhotoKey: key,
          updatedAt: '2026-08-04T09:00:00.000Z',
        }),
      },
    })
    const { report } = mergeState(local, makeState(), opts({ filePhotoKeys: new Set([key]) }))
    expect(report.photoWrites).toEqual([{ from: key, to: `${key}#${TOKEN}-0` }])
  })

  // The crash-window guarantee: nothing the import writes can land on a key the
  // still-live old state points at.
  it('never targets a live photo key', () => {
    const key = 'photo:2026-08-03:front'
    const live = new Set([key, 'photo:2026-08-03:side'])
    const { report } = mergeState(
      withFront(key, '2026-08-01T09:00:00.000Z'),
      withFront(key, '2026-09-01T09:00:00.000Z'),
      opts({ localPhotoKeys: live, filePhotoKeys: new Set([key]) }),
    )
    expect(report.photoWrites).toHaveLength(1)
    for (const write of report.photoWrites) expect(live.has(write.to)).toBe(false)
  })

  it('re-stages an already-staged key without nesting tokens', () => {
    const key = 'photo:2026-08-03:front#abc123'
    const { report } = mergeState(
      makeState(),
      withFront(key, '2026-08-03T09:00:00.000Z'),
      opts({ filePhotoKeys: new Set([key]) }),
    )
    expect(report.photoWrites).toEqual([
      { from: key, to: `photo:2026-08-03:front#${TOKEN}-0` },
    ])
  })

  it('keeps the local blob when the local record wins the field', () => {
    const key = 'photo:2026-08-03:front'
    const { report, next } = mergeState(
      withFront(key, '2026-08-05T09:00:00.000Z'),
      withFront(key, '2026-08-03T09:00:00.000Z'),
      opts({ localPhotoKeys: new Set([key]), filePhotoKeys: new Set([key]) }),
    )
    expect(report.photoWrites).toEqual([])
    expect(next.checkIns['2026-08-03']?.frontPhotoKey).toBe(key)
  })

  it('recovers from the file when the winning local reference has lost its blob', () => {
    const key = 'photo:2026-08-03:front'
    const { report, next } = mergeState(
      withFront(key, '2026-08-05T09:00:00.000Z'),
      withFront(key, '2026-08-03T09:00:00.000Z'),
      opts({ filePhotoKeys: new Set([key]) }),
    )
    expect(report.photoWrites).toEqual([{ from: key, to: `${key}#${TOKEN}-0` }])
    expect(next.checkIns['2026-08-03']?.frontPhotoKey).toBe(`${key}#${TOKEN}-0`)
  })

  it('strips a reference with no blob anywhere', () => {
    const key = 'photo:2026-08-03:front'
    const { next, report } = mergeState(
      makeState(),
      withFront(key, '2026-08-03T09:00:00.000Z'),
      opts(),
    )
    expect(next.checkIns['2026-08-03']?.frontPhotoKey).toBeUndefined()
    expect(report.strippedPhotoRefs).toEqual([key])
  })

  it('keeps a reference whose blob only exists locally', () => {
    const key = 'photo:2026-08-03:front'
    const { next, report } = mergeState(
      makeState(),
      withFront(key, '2026-08-03T09:00:00.000Z'),
      opts({ localPhotoKeys: new Set([key]) }),
    )
    expect(next.checkIns['2026-08-03']?.frontPhotoKey).toBe(key)
    expect(report.strippedPhotoRefs).toEqual([])
  })
})

describe('idempotency', () => {
  it('merging the same backup twice is a no-op', () => {
    const local = populatedState()
    const incoming = makeState({
      checklist: {
        '2026-08-06': {
          date: '2026-08-06',
          items: { completedWorkout: true },
          updatedAt: '2026-08-06T18:00:00.000Z',
        },
      },
      strengthLog: [strength('s3', 85, '2026-08-06T18:00:00.000Z')],
    })
    const photoOpts = opts({ localPhotoKeys: new Set(['photo:2026-11-16:front', 'photo:2026-11-16:side']) })
    const once = mergeState(local, incoming, photoOpts)
    const twice = mergeState(once.next, incoming, photoOpts)
    expect(twice.next).toEqual(once.next)
    expect(twice.report.added).toBe(0)
    expect(twice.report.updated).toBe(0)
  })
})
