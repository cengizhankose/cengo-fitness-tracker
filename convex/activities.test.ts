import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { pull, upsertBatch } from './activities'
import { get as syncStateGet } from './syncState'

/**
 * No convex-test harness exists in this repo yet (no other convex/*.test.ts precedes this
 * one). Rather than pull in a new dependency for one slice, this fakes just the `ctx.db`
 * surface activities.ts/syncState.ts actually call — query().withIndex().collect()/.unique(),
 * insert(), patch() — and invokes the registered functions' `._handler` directly (the same
 * property convex/server's registration_impl.js attaches to every query()/mutation() result).
 */
interface FakeQueryBuilder {
  eq(field: string, value: unknown): FakeQueryBuilder
  gt(field: string, value: unknown): FakeQueryBuilder
}

function makeFakeDb() {
  type Row = Record<string, unknown> & { _table: string; _id: string }
  const rows: Row[] = []
  let counter = 0

  return {
    query(table: string) {
      return {
        withIndex(_indexName: string, cb: (q: FakeQueryBuilder) => FakeQueryBuilder) {
          let filter: { field: string; op: 'eq' | 'gt'; value: unknown } | undefined
          const qb: FakeQueryBuilder = {
            eq(field, value) {
              filter = { field, op: 'eq', value }
              return qb
            },
            gt(field, value) {
              filter = { field, op: 'gt', value }
              return qb
            },
          }
          cb(qb)
          const scoped = rows.filter((r) => r._table === table)
          const filtered = !filter
            ? scoped
            : scoped.filter((r) =>
                filter!.op === 'eq'
                  ? r[filter!.field] === filter!.value
                  : (r[filter!.field] as string) > (filter!.value as string),
              )
          return {
            collect: async () => filtered,
            unique: async () => filtered[0],
          }
        },
      }
    },
    insert: async (table: string, doc: Record<string, unknown>) => {
      const _id = `${table}_${counter++}`
      rows.push({ _table: table, _id, ...doc })
      return _id
    },
    patch: async (_id: string, patch: Record<string, unknown>) => {
      const idx = rows.findIndex((r) => r._id === _id)
      if (idx >= 0) rows[idx] = { ...rows[idx], ...patch }
    },
  }
}

function makeCtx() {
  return { db: makeFakeDb() }
}

const SECRET = 'test-sync-secret'

const baseRecord = {
  id: 'garmin-123',
  garminId: 123,
  type: 'running' as const,
  sportGroup: 'run' as const,
  name: 'Morning Run',
  date: '2026-09-07',
  startTimeLocal: '2026-09-07T07:00:00',
  durationMin: 32.5,
  createdAt: '2026-09-07T07:35:00.000Z',
  updatedAt: '2026-09-07T07:35:00.000Z',
}

describe('convex/activities', () => {
  const originalSecret = process.env.SYNC_SECRET

  beforeEach(() => {
    process.env.SYNC_SECRET = SECRET
  })

  afterEach(() => {
    process.env.SYNC_SECRET = originalSecret
  })

  describe('auth', () => {
    it('pull rejects a missing/wrong syncSecret', async () => {
      const ctx = makeCtx()
      // @ts-expect-error _handler is attached at registration time, not in the public types
      await expect(pull._handler(ctx, { syncSecret: 'wrong' })).rejects.toThrow('Unauthorized')
    })

    it('upsertBatch rejects a missing/wrong syncSecret', async () => {
      const ctx = makeCtx()
      await expect(
        // @ts-expect-error same as above
        upsertBatch._handler(ctx, { records: [baseRecord], syncSecret: 'wrong' }),
      ).rejects.toThrow('Unauthorized')
    })
  })

  describe('upsertBatch + pull round-trip', () => {
    it('inserts a new record and pull returns it back verbatim', async () => {
      const ctx = makeCtx()
      // @ts-expect-error see note above
      await upsertBatch._handler(ctx, { records: [baseRecord], syncSecret: SECRET })

      // @ts-expect-error see note above
      const docs = await pull._handler(ctx, { syncSecret: SECRET })
      expect(docs).toEqual([baseRecord])
    })

    it('patches an existing record (matched by key) instead of duplicating it', async () => {
      const ctx = makeCtx()
      // @ts-expect-error see note above
      await upsertBatch._handler(ctx, { records: [baseRecord], syncSecret: SECRET })

      const updated = { ...baseRecord, comment: 'Great tempo run', updatedAt: '2026-09-07T08:00:00.000Z' }
      // @ts-expect-error see note above
      await upsertBatch._handler(ctx, { records: [updated], syncSecret: SECRET })

      // @ts-expect-error see note above
      const docs = await pull._handler(ctx, { syncSecret: SECRET })
      expect(docs).toHaveLength(1)
      expect(docs[0]).toEqual(updated)
    })

    it('pull with updatedSince only returns records newer than the cursor', async () => {
      const ctx = makeCtx()
      const older = { ...baseRecord, id: 'garmin-1', updatedAt: '2026-09-01T00:00:00.000Z' }
      const newer = { ...baseRecord, id: 'garmin-2', updatedAt: '2026-09-07T00:00:00.000Z' }
      // @ts-expect-error see note above
      await upsertBatch._handler(ctx, { records: [older, newer], syncSecret: SECRET })

      // @ts-expect-error see note above
      const docs = await pull._handler(ctx, {
        updatedSince: '2026-09-05T00:00:00.000Z',
        syncSecret: SECRET,
      })
      expect(docs).toEqual([newer])
    })

    it('carries every optional field through untouched, including arrays', async () => {
      const ctx = makeCtx()
      const full = {
        ...baseRecord,
        movingDurationMin: 31.0,
        distanceKm: 6.4,
        avgHr: 152,
        maxHr: 171,
        calories: 410,
        aerobicTE: 3.2,
        anaerobicTE: 0.4,
        trainingLoad: 88,
        hrZones: [{ zone: 1, min: 2 }, { zone: 2, min: 10 }],
        splits: [{ i: 1, distanceM: 1000, sec: 300, hr: 150 }],
        strokeSummary: undefined,
        avgCadence: 178,
        rawNotes: 'treadmill distance is estimated',
        comment: undefined,
        commentGeneratedAt: undefined,
        planAdherence: undefined,
        planRef: undefined,
      }
      // @ts-expect-error see note above
      await upsertBatch._handler(ctx, { records: [full], syncSecret: SECRET })

      // @ts-expect-error see note above
      const docs = await pull._handler(ctx, { syncSecret: SECRET })
      expect(docs[0].hrZones).toEqual(full.hrZones)
      expect(docs[0].splits).toEqual(full.splits)
      expect(docs[0].avgCadence).toBe(178)
    })

    it('bumps the activities syncState high-water mark to the latest updatedAt pushed', async () => {
      const ctx = makeCtx()
      const older = { ...baseRecord, id: 'garmin-1', updatedAt: '2026-09-01T00:00:00.000Z' }
      const newer = { ...baseRecord, id: 'garmin-2', updatedAt: '2026-09-07T00:00:00.000Z' }
      // @ts-expect-error see note above
      await upsertBatch._handler(ctx, { records: [older, newer], syncSecret: SECRET })

      // @ts-expect-error see note above
      const mark = await syncStateGet._handler(ctx, { slice: 'activities', syncSecret: SECRET })
      expect(mark).toBe('2026-09-07T00:00:00.000Z')
    })
  })
})
