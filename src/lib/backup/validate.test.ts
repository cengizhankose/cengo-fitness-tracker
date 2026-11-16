import { describe, expect, it } from 'vitest'
import { entries, set } from 'idb-keyval'
import { SCHEMA_VERSION, STORAGE_KEY, useStore } from '@/store'
import { readBackupFile } from './import'
import { validateBackup } from './validate'
import {
  MAX_LOG_ENTRIES,
  MAX_MAP_ENTRIES,
  MAX_PHOTOS,
  MAX_PHOTO_BYTES,
  MAX_SETS_PER_ENTRY,
  MAX_TOTAL_PHOTO_BYTES,
} from './format'
import type { ImportErrorCode } from './format'
import {
  backupDoc,
  fakePhoto,
  photoEntry,
  legacyBackupDoc,
  legacyState,
  populatedState,
  resetStore,
  toFile,
} from '@/test/fixtures'

function codeOf(doc: unknown): ImportErrorCode | 'OK' {
  const result = validateBackup(doc)
  return result.ok ? 'OK' : result.error.code
}

function firstIssuePath(doc: unknown): string | undefined {
  const result = validateBackup(doc)
  return result.ok ? undefined : result.error.issues?.[0]?.path
}

describe('validateBackup', () => {
  it('accepts a well-formed backup', () => {
    expect(codeOf(backupDoc())).toBe('OK')
  })

  it('rejects a non-object', () => {
    expect(codeOf('nope')).toBe('E_NOT_JSON')
  })

  it('rejects a foreign JSON file rather than guessing at it', () => {
    expect(codeOf({ some: 'other app', state: {} })).toBe('E_BAD_MAGIC')
    expect(codeOf(backupDoc({ magic: 'other-backup' }))).toBe('E_BAD_MAGIC')
  })

  it('hard-stops on a newer file format', () => {
    expect(codeOf(backupDoc({ formatVersion: 2 }))).toBe('E_FORMAT_NEWER')
    expect(codeOf(backupDoc({ formatVersion: 99 }))).toBe('E_FORMAT_NEWER')
  })

  it('requires an exact format version — old, negative and fractional all fail', () => {
    for (const v of [0, -1, 1.5, 0.999, '1', null, undefined, Number.NaN]) {
      expect(codeOf(backupDoc({ formatVersion: v }))).toBe('E_FORMAT_UNSUPPORTED')
    }
    // 2.5 is "newer" numerically but still not an integer version we can read.
    expect(codeOf(backupDoc({ formatVersion: 2.5 }))).toBe('E_FORMAT_UNSUPPORTED')
  })

  it('rejects a schema version outside 1..3 or not an integer', () => {
    for (const v of [0, 4, 2.5, '3']) {
      expect(codeOf(backupDoc({ schemaVersion: v }))).toBe('E_SCHEMA_MISMATCH')
    }
  })

  // derive.ts:244 and LogScreen.tsx:137 call createdAt.localeCompare during render.
  it('rejects a log entry with a missing createdAt (white-screen regression)', () => {
    const state = populatedState()
    const entry = state.strengthLog[0]
    if (!entry) throw new Error('fixture missing')
    const doc = backupDoc({
      state: { ...state, strengthLog: [{ ...entry, createdAt: undefined }] },
    })
    expect(codeOf(doc)).toBe('E_INVALID')
    expect(firstIssuePath(doc)).toBe('state.strengthLog[0].createdAt')
  })

  it('rejects Infinity smuggled in as 1e999', () => {
    const doc = JSON.parse(
      JSON.stringify(backupDoc()).replace('"distanceKm":8.2', '"distanceKm":1e999'),
    ) as unknown
    expect(codeOf(doc)).toBe('E_INVALID')
    expect(firstIssuePath(doc)).toBe('state.runLog[0].distanceKm')
  })

  it('rejects a non-array sets field (derive.ts calls .reduce on it)', () => {
    const state = populatedState()
    const entry = state.strengthLog[0]
    if (!entry) throw new Error('fixture missing')
    const doc = backupDoc({ state: { ...state, strengthLog: [{ ...entry, sets: 'lots' }] } })
    expect(codeOf(doc)).toBe('E_INVALID')
    expect(firstIssuePath(doc)).toBe('state.strengthLog[0].sets')
  })

  it('rejects a calendar-invalid date that passes the regex', () => {
    const state = populatedState()
    const doc = backupDoc({ state: { ...state, checklist: { '2026-02-31': {
      date: '2026-02-31', items: {}, updatedAt: '2026-02-31T00:00:00.000Z',
    } } } })
    expect(codeOf(doc)).toBe('E_INVALID')
  })

  it('rejects prototype-pollution map keys', () => {
    const state = populatedState()
    const checklist = JSON.parse(
      '{"__proto__":{"date":"2026-08-03","items":{},"updatedAt":"x"}}',
    ) as Record<string, unknown>
    // JSON.parse keeps __proto__ as an own property; the validator must refuse it.
    const doc = backupDoc({ state: { ...state, checklist } })
    expect(codeOf(doc)).toBe('E_INVALID')
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined()
  })

  it('rejects a map key that disagrees with the record it holds', () => {
    const state = populatedState()
    const doc = backupDoc({ state: { ...state, checkIns: { '2026-08-10': {
      date: '2026-08-03', createdAt: 'a', updatedAt: 'b',
    } } } })
    expect(codeOf(doc)).toBe('E_INVALID')
    expect(firstIssuePath(doc)).toBe('state.checkIns["2026-08-10"].date')
  })

  it('requires canonical ISO timestamps on every field the merge orders by', () => {
    const state = populatedState()
    const entry = state.strengthLog[0]
    const run = state.runLog[0]
    if (!entry || !run) throw new Error('fixture missing')

    const bad = ['2026-08-03', '2026-08-03T18:00:00Z', '2026-08-03T18:00:00.000+03:00', 'yesterday', '2026-13-45T00:00:00.000Z']
    for (const value of bad) {
      expect(codeOf(backupDoc({ state: { ...state, strengthLog: [{ ...entry, createdAt: value }] } })))
        .toBe('E_INVALID')
    }
    expect(codeOf(backupDoc({ state: { ...state, runLog: [{ ...run, createdAt: '' }] } })))
      .toBe('E_INVALID')
    expect(codeOf(backupDoc({ exportedAt: '8 August 2026' }))).toBe('E_INVALID')
  })

  it('rejects a non-canonical checkIn timestamp', () => {
    const state = populatedState()
    const doc = backupDoc({ state: { ...state, checkIns: { '2026-08-03': {
      date: '2026-08-03',
      createdAt: '2026-08-03T07:00:00.000Z',
      updatedAt: '2026-08-03T07:00:00Z',
    } } } })
    expect(codeOf(doc)).toBe('E_INVALID')
    expect(firstIssuePath(doc)).toBe('state.checkIns["2026-08-03"].updatedAt')
  })

  it('rejects an oversized notes field', () => {
    const state = populatedState()
    const entry = state.runLog[0]
    if (!entry) throw new Error('fixture missing')
    const doc = backupDoc({
      state: { ...state, runLog: [{ ...entry, notes: 'x'.repeat(10_001) }] },
    })
    expect(codeOf(doc)).toBe('E_INVALID')
  })

  it('keeps legacy checklist keys and drops truly unknown ones instead of failing', () => {
    const state = populatedState()
    const doc = backupDoc({ state: { ...state, checklist: { '2026-08-03': {
      date: '2026-08-03',
      items: { completedWorkout: true, noAlcohol: true, steps10000Plus: false, ateCake: true },
      updatedAt: '2026-08-03T18:00:00.000Z',
    } } } })
    const result = validateBackup(doc)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.state.checklist['2026-08-03']?.items).toEqual({
      completedWorkout: true,
      noAlcohol: true,
      steps10000Plus: false,
    })
  })

  it('reports at most five issues', () => {
    const state = populatedState()
    const broken = Object.fromEntries(
      Array.from({ length: 9 }, (_, i) => [`not-a-date-${i}`, {}]),
    )
    const result = validateBackup(backupDoc({ state: { ...state, checklist: broken } }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.issues).toHaveLength(5)
  })
})

describe('older schemas import onto the v3 shape', () => {
  for (const version of [1, 2] as const) {
    it(`accepts a v${version} backup and keeps its user data`, () => {
      const result = validateBackup(legacyBackupDoc(version))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const legacy = legacyState(version)
      const state = result.value.state
      expect(result.value.schemaVersion).toBe(SCHEMA_VERSION)
      expect(state._schemaVersion).toBe(SCHEMA_VERSION)
      expect(state.checklist).toEqual(legacy['checklist'])
      expect(state.checkIns).toEqual(legacy['checkIns'])
      expect(state.strengthLog).toEqual(legacy['strengthLog'])
      expect(state.runLog).toEqual(legacy['runLog'])
    })
  }

  it('drops the retired slices and the old-shape activeSession of a v2 file', () => {
    const result = validateBackup(legacyBackupDoc(2))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const state = result.value.state as unknown as Record<string, unknown>
    expect('benchmark' in state).toBe(false)
    expect('marathonStatus' in state).toBe(false)
    expect(state['activeSession']).toBeUndefined()
  })

  it('does not reject a v2 file whose retired slices are malformed', () => {
    const doc = legacyBackupDoc(2)
    doc['state'] = {
      ...legacyState(2),
      benchmark: { date: 'garbage', timeSec: 'slow' },
      marathonStatus: { 'not-a-date': null, __junk: 7 },
    }
    expect(codeOf(doc)).toBe('OK')
    doc['state'] = { ...legacyState(2), benchmark: 'nope', marathonStatus: null }
    expect(codeOf(doc)).toBe('OK')
  })

  it('keeps legacy checklist keys of a v1 file and drops a truly unknown key', () => {
    const legacy = legacyState(1)
    const doc = legacyBackupDoc(1)
    doc['state'] = {
      ...legacy,
      checklist: {
        '2026-08-03': {
          date: '2026-08-03',
          items: { completedWorkout: true, completedStretching: true, hitCalorieTarget: false, ateCake: true },
          updatedAt: '2026-08-03T18:00:00.000Z',
        },
      },
    }
    const result = validateBackup(doc)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.state.checklist['2026-08-03']?.items).toEqual({
      completedWorkout: true,
      completedStretching: true,
      hitCalorieTarget: false,
    })
  })
})

describe('settings', () => {
  it('ignores the old programStartDate — validated settings are always {}', () => {
    const result = validateBackup(legacyBackupDoc(2))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.state.settings).toEqual({})

    // Even a garbage value inside settings is ignored, not rejected.
    const garbage = validateBackup(
      backupDoc({ state: { ...populatedState(), settings: { programStartDate: 'garbage' } } }),
    )
    expect(garbage.ok).toBe(true)
    if (!garbage.ok) return
    expect(garbage.value.state.settings).toEqual({})
  })

  it('accepts a state without settings', () => {
    const state = populatedState() as unknown as Record<string, unknown>
    delete state['settings']
    const result = validateBackup(backupDoc({ state }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.state.settings).toEqual({})
  })

  it('rejects non-object settings', () => {
    for (const settings of ['nope', 7, [], null]) {
      const doc = backupDoc({ state: { ...populatedState(), settings } })
      expect(codeOf(doc)).toBe('E_INVALID')
      expect(firstIssuePath(doc)).toBe('state.settings')
    }
  })
})

describe('v3 activeSession', () => {
  const session = {
    id: 'session-2',
    date: '2026-11-16',
    planSessionId: 'upper-a',
    exerciseNames: ['Bench Press', 'Chest Supported Row'],
    currentIndex: 1,
    startedAt: '2026-11-16T07:00:00.000Z',
  }

  it('accepts the new shape', () => {
    const result = validateBackup(
      backupDoc({ state: { ...populatedState(), activeSession: session } }),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.state.activeSession).toEqual(session)
  })

  it('accepts a free session with no exercises yet', () => {
    const free = { ...session, planSessionId: 'free', exerciseNames: [], currentIndex: 0 }
    const result = validateBackup(backupDoc({ state: { ...populatedState(), activeSession: free } }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.state.activeSession).toEqual(free)
  })

  it('rejects a v3 session missing planSessionId', () => {
    const withoutPlan: Record<string, unknown> = { ...session }
    delete withoutPlan['planSessionId']
    const doc = backupDoc({ state: { ...populatedState(), activeSession: withoutPlan } })
    expect(codeOf(doc)).toBe('E_INVALID')
    expect(firstIssuePath(doc)).toBe('state.activeSession.planSessionId')
  })
})

describe('v3 record fields survive validation', () => {
  it('preserves set kind/id, entry sessionId/updatedAt, autoWorkout and legacy checklist keys', () => {
    const result = validateBackup(backupDoc())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const expected = populatedState()
    expect(result.value.state).toEqual(expected)
    const s2 = result.value.state.strengthLog.find((e) => e.id === 's2')
    expect(s2?.sets.map((s) => [s.id, s.kind])).toEqual([
      ['set-1', 'warmup'],
      ['set-2', 'working'],
    ])
    expect(s2?.sessionId).toBe('session-1')
    expect(s2?.updatedAt).toBe('2026-11-16T07:25:00.000Z')
    expect(result.value.state.checklist['2026-11-16']?.autoWorkout).toBe(true)
    expect(result.value.state.checklist['2026-11-15']?.items).toEqual({
      completedWorkout: true,
      noAlcohol: true,
      sleep75Plus: false,
    })
  })

  it('rejects an unknown set kind', () => {
    const state = populatedState()
    const entry = state.strengthLog[0]
    if (!entry) throw new Error('fixture missing')
    const doc = backupDoc({
      state: { ...state, strengthLog: [{ ...entry, sets: [{ weightKg: 60, reps: 5, kind: 'drop' }] }] },
    })
    expect(codeOf(doc)).toBe('E_INVALID')
    expect(firstIssuePath(doc)).toBe('state.strengthLog[0].sets[0].kind')
  })

  it('rejects a non-canonical strength updatedAt', () => {
    const state = populatedState()
    const entry = state.strengthLog[0]
    if (!entry) throw new Error('fixture missing')
    const doc = backupDoc({
      state: { ...state, strengthLog: [{ ...entry, updatedAt: '2026-11-16T07:25:00Z' }] },
    })
    expect(codeOf(doc)).toBe('E_INVALID')
    expect(firstIssuePath(doc)).toBe('state.strengthLog[0].updatedAt')
  })
})

describe('photo entries are validated strictly, before anything is written', () => {
  const KEY = 'photo:2026-08-03:front'

  it('accepts canonical and staged keys', () => {
    expect(codeOf(backupDoc({ photos: [photoEntry(KEY)] }))).toBe('OK')
    expect(codeOf(backupDoc({ photos: [photoEntry(`${KEY}#a1b2c3`)] }))).toBe('OK')
  })

  it('rejects malformed keys rather than dropping the entry', () => {
    for (const key of [
      'photo:2026-08-03:back',
      'photo:2026-8-3:front',
      'photo:2026-08-03',
      'notaphoto',
      'photo:2026-08-03:front#UPPER',
      '',
    ]) {
      expect(codeOf(backupDoc({ photos: [photoEntry(key)] }))).toBe('E_INVALID')
    }
  })

  it('rejects duplicate keys', () => {
    const doc = backupDoc({ photos: [photoEntry(KEY, 1), photoEntry(KEY, 2)] })
    expect(codeOf(doc)).toBe('E_INVALID')
    expect(firstIssuePath(doc)).toBe('photos[1].key')
  })

  it('rejects unsupported MIME types', () => {
    for (const mime of ['image/heic', 'image/gif', 'application/pdf', 'text/html', '', 7]) {
      const doc = backupDoc({ photos: [{ ...photoEntry(KEY), mime }] })
      expect(codeOf(doc)).toBe('E_INVALID')
    }
    for (const mime of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(codeOf(backupDoc({ photos: [{ ...photoEntry(KEY), mime }] }))).toBe('OK')
    }
  })

  it('requires a positive, bounded, integral byte count', () => {
    for (const bytes of [0, -1, 1.5, Number.NaN, '32', null, MAX_PHOTO_BYTES + 1]) {
      const doc = backupDoc({ photos: [{ ...photoEntry(KEY), bytes }] })
      expect(codeOf(doc)).toBe('E_INVALID')
    }
  })

  it('requires the decoded size to match the declared size exactly', () => {
    const entry = photoEntry(KEY, 1, 32)
    expect(codeOf(backupDoc({ photos: [{ ...entry, bytes: 31 }] }))).toBe('E_INVALID')
    expect(codeOf(backupDoc({ photos: [{ ...entry, bytes: 33 }] }))).toBe('E_INVALID')

    const doc = backupDoc({ photos: [{ ...entry, data: '!!!!' }] })
    expect(codeOf(doc)).toBe('E_INVALID')
    expect(firstIssuePath(doc)).toBe('photos[0].data')
  })

  it('caps the photo count', () => {
    const photos = Array.from({ length: MAX_PHOTOS + 1 }, (_, i) =>
      photoEntry(`photo:2026-08-03:front#p${i}`),
    )
    const doc = backupDoc({ photos })
    expect(codeOf(doc)).toBe('E_INVALID')
    expect(firstIssuePath(doc)).toBe('photos')
  })

  it('caps the declared total before inspecting any payload', () => {
    const count = Math.ceil(MAX_TOTAL_PHOTO_BYTES / MAX_PHOTO_BYTES) + 1
    const photos = Array.from({ length: count }, (_, i) => ({
      ...photoEntry(`photo:2026-08-03:front#q${i}`),
      bytes: MAX_PHOTO_BYTES,
    }))
    expect(codeOf(backupDoc({ photos }))).toBe('E_INVALID')
  })

  it('rejects a check-in referencing a malformed photo key', () => {
    const state = populatedState()
    const doc = backupDoc({ state: { ...state, checkIns: { '2026-08-03': {
      date: '2026-08-03',
      frontPhotoKey: 'photo:../../etc/passwd',
      createdAt: '2026-08-03T07:00:00.000Z',
      updatedAt: '2026-08-03T07:00:00.000Z',
    } } } })
    expect(codeOf(doc)).toBe('E_INVALID')
    expect(firstIssuePath(doc)).toBe('state.checkIns["2026-08-03"].frontPhotoKey')
  })
})

describe('photo references are cross-validated against their check-in', () => {
  const withRefs = (refs: Record<string, unknown>) => {
    const state = populatedState()
    return backupDoc({
      state: {
        ...state,
        checkIns: {
          '2026-08-03': {
            date: '2026-08-03',
            createdAt: '2026-08-03T07:00:00.000Z',
            updatedAt: '2026-08-03T07:00:00.000Z',
            ...refs,
          },
        },
      },
    })
  }

  it('accepts keys whose date and slot match, in both canonical and staged form', () => {
    expect(codeOf(withRefs({
      frontPhotoKey: 'photo:2026-08-03:front',
      sidePhotoKey: 'photo:2026-08-03:side',
    }))).toBe('OK')
    expect(codeOf(withRefs({
      frontPhotoKey: 'photo:2026-08-03:front#a1b2c3-0',
      sidePhotoKey: 'photo:2026-08-03:side#a1b2c3-1',
    }))).toBe('OK')
  })

  // A key pointing at another date would attach a different week's photo — the
  // silent-wrong-data case, not a cosmetic mismatch.
  it('rejects a key whose date is not the check-in date', () => {
    const doc = withRefs({ frontPhotoKey: 'photo:2026-08-10:front' })
    expect(codeOf(doc)).toBe('E_INVALID')
    expect(firstIssuePath(doc)).toBe('state.checkIns["2026-08-03"].frontPhotoKey')
    expect(codeOf(withRefs({ sidePhotoKey: 'photo:2025-01-06:side' }))).toBe('E_INVALID')
    expect(codeOf(withRefs({ frontPhotoKey: 'photo:2026-08-10:front#tok-0' }))).toBe('E_INVALID')
  })

  it('rejects a key whose slot is not the field holding it', () => {
    const doc = withRefs({ frontPhotoKey: 'photo:2026-08-03:side' })
    expect(codeOf(doc)).toBe('E_INVALID')
    expect(firstIssuePath(doc)).toBe('state.checkIns["2026-08-03"].frontPhotoKey')
    expect(codeOf(withRefs({ sidePhotoKey: 'photo:2026-08-03:front' }))).toBe('E_INVALID')
  })

  it('rejects a swapped front/side pair even though both keys are well-formed', () => {
    expect(codeOf(withRefs({
      frontPhotoKey: 'photo:2026-08-03:side',
      sidePhotoKey: 'photo:2026-08-03:front',
    }))).toBe('E_INVALID')
  })
})

describe('collection limits', () => {
  it('caps map and log sizes', () => {
    const state = populatedState()
    const bigMap = Object.fromEntries(
      Array.from({ length: MAX_MAP_ENTRIES + 1 }, (_, i) => [`key-${i}`, {}]),
    )
    expect(codeOf(backupDoc({ state: { ...state, checklist: bigMap } }))).toBe('E_INVALID')

    const bigLog = Array.from({ length: MAX_LOG_ENTRIES + 1 }, () => ({}))
    expect(codeOf(backupDoc({ state: { ...state, runLog: bigLog } }))).toBe('E_INVALID')
  })

  it('caps sets per strength entry', () => {
    const state = populatedState()
    const entry = state.strengthLog[0]
    if (!entry) throw new Error('fixture missing')
    const sets = Array.from({ length: MAX_SETS_PER_ENTRY + 1 }, () => ({ weightKg: 80, reps: 8 }))
    const doc = backupDoc({ state: { ...state, strengthLog: [{ ...entry, sets }] } })
    expect(codeOf(doc)).toBe('E_INVALID')
    expect(firstIssuePath(doc)).toBe('state.strengthLog[0].sets')
  })
})

describe('readBackupFile leaves live data untouched', () => {
  const cases: Array<[string, unknown]> = [
    ['not JSON at all', '{ this is not json'],
    ['foreign JSON', { hello: 'world' }],
    ['bad magic', backupDoc({ magic: 'nope' })],
    ['newer format', backupDoc({ formatVersion: 99 })],
    ['schema mismatch', backupDoc({ schemaVersion: 7 })],
    ['missing createdAt', backupDoc({ state: { ...populatedState(), strengthLog: [
      { id: 's1', date: '2026-11-16', exerciseName: 'Bench', sets: [] },
    ] } })],
  ]

  it.each(cases)('%s → error, zero mutation', async (_label, doc) => {
    const before = populatedState()
    resetStore(before)
    const envelope = JSON.stringify({ state: before, version: 1 })
    localStorage.setItem(STORAGE_KEY, envelope)
    const photo = fakePhoto(1)
    await set('photo:2026-11-16:front', photo)

    const file =
      typeof doc === 'string'
        ? new File([doc], 'backup.json', { type: 'application/json' })
        : toFile(doc)
    const result = await readBackupFile(file)

    expect(result.ok).toBe(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(envelope)
    expect(useStore.getState().strengthLog).toEqual(before.strengthLog)
    const idb = await entries()
    expect(idb.map(([k]) => k)).toEqual(['photo:2026-11-16:front'])
  })
})
