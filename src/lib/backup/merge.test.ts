import { describe, expect, it } from 'vitest'
import type { CheckIn, StrengthLogEntry } from '@/types/userData'
import { mergeState } from './merge'
import type { MergeOptions } from './merge'
import { makeState, populatedState } from '@/test/fixtures'

const NO_PHOTOS: Pick<MergeOptions, 'localPhotoKeys' | 'filePhotoKeys'> = {
  localPhotoKeys: new Set(),
  filePhotoKeys: new Set(),
}

const TOKEN = 'tok0'

function opts(over: Partial<MergeOptions> = {}): MergeOptions {
  return { mode: 'merge', includeSettings: false, stageToken: TOKEN, ...NO_PHOTOS, ...over }
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
  it('keeps the local program start date by default', () => {
    const local = makeState({ settings: { programStartDate: '2026-08-03' } })
    const incoming = makeState({ settings: { programStartDate: '2026-05-11' } })
    const { next, report } = mergeState(local, incoming, opts())
    expect(next.settings.programStartDate).toBe('2026-08-03')
    expect(report.settings).toBe('kept-local')
  })

  it('adopts it when explicitly asked, and always in replace mode', () => {
    const local = makeState({ settings: { programStartDate: '2026-08-03' } })
    const incoming = makeState({ settings: { programStartDate: '2026-05-11' } })
    expect(mergeState(local, incoming, opts({ includeSettings: true })).next.settings)
      .toEqual({ programStartDate: '2026-05-11' })
    expect(mergeState(local, incoming, opts({ mode: 'replace' })).next.settings)
      .toEqual({ programStartDate: '2026-05-11' })
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

describe('benchmark', () => {
  const bench = (createdAt: string, timeSec: number) => ({
    date: '2026-08-02',
    timeSec,
    createdAt,
  })

  it('takes the newer one', () => {
    const local = makeState({ benchmark: bench('2026-08-02T09:00:00.000Z', 1380) })
    const incoming = makeState({ benchmark: bench('2026-09-02T09:00:00.000Z', 1300) })
    const { next, report } = mergeState(local, incoming, opts())
    expect(next.benchmark?.timeSec).toBe(1300)
    expect(report.benchmark).toBe('took-incoming')
  })

  it('never clears a local benchmark in merge mode', () => {
    const local = makeState({ benchmark: bench('2026-08-02T09:00:00.000Z', 1380) })
    const { next } = mergeState(local, makeState(), opts())
    expect(next.benchmark?.timeSec).toBe(1380)
  })
})

describe('replace mode', () => {
  it('swaps every collection and reports removals', () => {
    const local = populatedState()
    const incoming = makeState({
      settings: { programStartDate: '2026-05-11' },
      runLog: [
        { id: 'r9', date: '2026-05-11', distanceKm: 5, createdAt: '2026-05-11T06:00:00.000Z' },
      ],
    })
    const { next, report } = mergeState(local, incoming, opts({ mode: 'replace' }))
    expect(next.strengthLog).toEqual([])
    expect(next.runLog.map((e) => e.id)).toEqual(['r9'])
    expect(next.benchmark).toBeUndefined()
    expect(next.marathonStatus).toEqual({})
    expect(report.added).toBe(1)
    // populatedState() carries one marathonStatus record alongside the other 6 (Slice 9).
    expect(report.removed).toBe(7)
  })
})

describe('marathonStatus (Slice 9)', () => {
  const rec = (date: string, status: 'completed' | 'skipped', updatedAt: string, notes?: string) => ({
    date,
    status,
    notes,
    updatedAt,
  })

  it('merge mode: newer updatedAt wins', () => {
    const local = makeState({
      marathonStatus: { '2026-09-02': rec('2026-09-02', 'completed', '2026-09-02T10:00:00.000Z') },
    })
    const incoming = makeState({
      marathonStatus: { '2026-09-02': rec('2026-09-02', 'skipped', '2026-09-02T18:00:00.000Z') },
    })
    const { next } = mergeState(local, incoming, opts())
    expect(next.marathonStatus['2026-09-02']?.status).toBe('skipped')
  })

  it('merge mode: a tie keeps local', () => {
    const t = '2026-09-02T10:00:00.000Z'
    const local = makeState({ marathonStatus: { '2026-09-02': rec('2026-09-02', 'completed', t) } })
    const incoming = makeState({ marathonStatus: { '2026-09-02': rec('2026-09-02', 'skipped', t) } })
    const { next } = mergeState(local, incoming, opts())
    expect(next.marathonStatus['2026-09-02']?.status).toBe('completed')
  })

  it('merge mode: adds a date the local state has never seen', () => {
    const local = makeState()
    const incoming = makeState({
      marathonStatus: { '2026-09-02': rec('2026-09-02', 'completed', '2026-09-02T10:00:00.000Z') },
    })
    const { next, report } = mergeState(local, incoming, opts())
    expect(Object.keys(next.marathonStatus)).toEqual(['2026-09-02'])
    expect(report.added).toBe(1)
  })

  it('replace mode takes the incoming map wholesale', () => {
    const local = makeState({
      marathonStatus: { '2026-08-31': rec('2026-08-31', 'completed', '2026-08-31T10:00:00.000Z') },
    })
    const incoming = makeState({
      marathonStatus: { '2026-09-02': rec('2026-09-02', 'skipped', '2026-09-02T10:00:00.000Z') },
    })
    const { next } = mergeState(local, incoming, opts({ mode: 'replace' }))
    expect(Object.keys(next.marathonStatus)).toEqual(['2026-09-02'])
  })

  it('report.added/updated count marathon records via recordEntries', () => {
    const local = makeState({
      marathonStatus: { '2026-08-31': rec('2026-08-31', 'completed', '2026-08-31T10:00:00.000Z') },
    })
    const incoming = makeState({
      marathonStatus: {
        '2026-08-31': rec('2026-08-31', 'skipped', '2026-08-31T18:00:00.000Z'),
        '2026-09-02': rec('2026-09-02', 'completed', '2026-09-02T10:00:00.000Z'),
      },
    })
    const { report } = mergeState(local, incoming, opts())
    expect(report.added).toBe(1)
    expect(report.updated).toBe(1)
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
      strengthLog: [strength('s2', 85, '2026-08-06T18:00:00.000Z')],
    })
    const photoOpts = opts({ localPhotoKeys: new Set(['photo:2026-08-03:front', 'photo:2026-08-03:side']) })
    const once = mergeState(local, incoming, photoOpts)
    const twice = mergeState(once.next, incoming, photoOpts)
    expect(twice.next).toEqual(once.next)
    expect(twice.report.added).toBe(0)
    expect(twice.report.updated).toBe(0)
  })
})
