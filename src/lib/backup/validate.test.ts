import { describe, expect, it } from 'vitest'
import { entries, set } from 'idb-keyval'
import { STORAGE_KEY, useStore } from '@/store'
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

  it('rejects a mismatched state schema version', () => {
    expect(codeOf(backupDoc({ schemaVersion: 3 }))).toBe('E_SCHEMA_MISMATCH')
    expect(codeOf(backupDoc({ schemaVersion: 0 }))).toBe('E_SCHEMA_MISMATCH')
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

  it('rejects an unparseable programStartDate', () => {
    const state = populatedState()
    const doc = backupDoc({ state: { ...state, settings: { programStartDate: 'garbage' } } })
    expect(codeOf(doc)).toBe('E_INVALID')
    expect(firstIssuePath(doc)).toBe('state.settings.programStartDate')
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

  it('drops unknown checklist item keys instead of failing', () => {
    const state = populatedState()
    const doc = backupDoc({ state: { ...state, checklist: { '2026-08-03': {
      date: '2026-08-03',
      items: { completedWorkout: true, ateCake: true },
      updatedAt: '2026-08-03T18:00:00.000Z',
    } } } })
    const result = validateBackup(doc)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.state.checklist['2026-08-03']?.items).toEqual({ completedWorkout: true })
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

describe('marathonStatus — additive, backward compatible (Slice 9)', () => {
  it('a backup without state.marathonStatus validates clean -> {}, no issue reported', () => {
    const state = populatedState()
    const withoutKey = { ...state } as Record<string, unknown>
    delete withoutKey['marathonStatus']
    const doc = backupDoc({ state: withoutKey })
    const result = validateBackup(doc)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.state.marathonStatus).toEqual({})
  })

  it('rejects an explicit null — only undefined/missing is the backward-compatible legacy case', () => {
    const state = populatedState()
    const doc = backupDoc({ state: { ...state, marathonStatus: null } })
    const result = validateBackup(doc)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('E_INVALID')
    expect(result.error.issues?.[0]?.path).toBe('state.marathonStatus')
  })

  it('accepts a well-formed entry', () => {
    const state = populatedState()
    const doc = backupDoc({
      state: {
        ...state,
        marathonStatus: {
          '2026-09-02': {
            date: '2026-09-02',
            status: 'completed',
            notes: 'felt strong',
            updatedAt: '2026-09-02T19:00:00.000Z',
          },
        },
      },
    })
    const result = validateBackup(doc)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.state.marathonStatus['2026-09-02']).toEqual({
      date: '2026-09-02',
      status: 'completed',
      notes: 'felt strong',
      updatedAt: '2026-09-02T19:00:00.000Z',
    })
  })

  it('rejects the way checklist is: non-object map, bad date key, date !== key', () => {
    const state = populatedState()
    expect(codeOf(backupDoc({ state: { ...state, marathonStatus: 'nope' } }))).toBe('E_INVALID')
    expect(
      codeOf(
        backupDoc({
          state: {
            ...state,
            marathonStatus: { 'not-a-date': { date: 'not-a-date', status: 'completed', updatedAt: '2026-09-02T19:00:00.000Z' } },
          },
        }),
      ),
    ).toBe('E_INVALID')
    expect(
      codeOf(
        backupDoc({
          state: {
            ...state,
            marathonStatus: {
              '2026-09-02': { date: '2026-09-03', status: 'completed', updatedAt: '2026-09-02T19:00:00.000Z' },
            },
          },
        }),
      ),
    ).toBe('E_INVALID')
  })

  it('rejects a bad status string', () => {
    const state = populatedState()
    const doc = backupDoc({
      state: {
        ...state,
        marathonStatus: {
          '2026-09-02': { date: '2026-09-02', status: 'done', updatedAt: '2026-09-02T19:00:00.000Z' },
        },
      },
    })
    expect(codeOf(doc)).toBe('E_INVALID')
    expect(firstIssuePath(doc)).toBe('state.marathonStatus["2026-09-02"].status')
  })

  it('rejects a missing or non-canonical updatedAt', () => {
    const state = populatedState()
    expect(
      codeOf(
        backupDoc({
          state: { ...state, marathonStatus: { '2026-09-02': { date: '2026-09-02', status: 'completed' } } },
        }),
      ),
    ).toBe('E_INVALID')
    expect(
      codeOf(
        backupDoc({
          state: {
            ...state,
            marathonStatus: {
              '2026-09-02': { date: '2026-09-02', status: 'completed', updatedAt: '2026-09-02T19:00:00Z' },
            },
          },
        }),
      ),
    ).toBe('E_INVALID')
  })

  it('rejects a __proto__ key', () => {
    const state = populatedState()
    const marathonStatus = JSON.parse(
      '{"__proto__":{"date":"2026-09-02","status":"completed","updatedAt":"2026-09-02T19:00:00.000Z"}}',
    ) as Record<string, unknown>
    expect(codeOf(backupDoc({ state: { ...state, marathonStatus } }))).toBe('E_INVALID')
  })

  it('caps entries at MAX_MAP_ENTRIES', () => {
    const state = populatedState()
    const big = Object.fromEntries(Array.from({ length: MAX_MAP_ENTRIES + 1 }, (_, i) => [`key-${i}`, {}]))
    expect(codeOf(backupDoc({ state: { ...state, marathonStatus: big } }))).toBe('E_INVALID')
  })

  it('rejects an oversized notes field', () => {
    const state = populatedState()
    const doc = backupDoc({
      state: {
        ...state,
        marathonStatus: {
          '2026-09-02': {
            date: '2026-09-02',
            status: 'completed',
            notes: 'x'.repeat(10_001),
            updatedAt: '2026-09-02T19:00:00.000Z',
          },
        },
      },
    })
    expect(codeOf(doc)).toBe('E_INVALID')
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
      { id: 's1', date: '2026-08-03', exerciseName: 'Bench', sets: [] },
    ] } })],
  ]

  it.each(cases)('%s → error, zero mutation', async (_label, doc) => {
    const before = populatedState()
    resetStore(before)
    const envelope = JSON.stringify({ state: before, version: 1 })
    localStorage.setItem(STORAGE_KEY, envelope)
    const photo = fakePhoto(1)
    await set('photo:2026-08-03:front', photo)

    const file =
      typeof doc === 'string'
        ? new File([doc], 'backup.json', { type: 'application/json' })
        : toFile(doc)
    const result = await readBackupFile(file)

    expect(result.ok).toBe(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(envelope)
    expect(useStore.getState().strengthLog).toEqual(before.strengthLog)
    const idb = await entries()
    expect(idb.map(([k]) => k)).toEqual(['photo:2026-08-03:front'])
  })
})
