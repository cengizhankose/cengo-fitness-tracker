import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { touchSyncState, syncSecretArg } from './lib'
import { requireSyncSecret } from './auth'
import { BENCHMARK_SINGLETON_KEY } from './validators'

// Singleton: the store holds at most one BenchmarkResult. Kept as a table (rather than a
// one-off document lookup) so it shares the same pull(updatedSince)/upsertBatch(records) shape
// as every other synced slice — the client-side sync code has one code path, not six.
const record = {
  date: v.string(),
  timeSec: v.number(),
  averagePace: v.optional(v.string()),
  averageHeartRate: v.optional(v.number()),
  maxHeartRate: v.optional(v.number()),
  notes: v.optional(v.string()),
  createdAt: v.string(),
  updatedAt: v.string(), // effective: always createdAt
}

export const pull = query({
  args: { updatedSince: v.optional(v.string()), ...syncSecretArg },
  handler: async (ctx, { updatedSince, syncSecret }) => {
    requireSyncSecret(ctx, syncSecret)
    const docs = await ctx.db
      .query('benchmark')
      .withIndex('by_updatedAt', (q) =>
        updatedSince ? q.gt('updatedAt', updatedSince) : q,
      )
      .collect()
    return docs.map(
      ({ date, timeSec, averagePace, averageHeartRate, maxHeartRate, notes, createdAt, updatedAt }) => ({
        date,
        timeSec,
        averagePace,
        averageHeartRate,
        maxHeartRate,
        notes,
        createdAt,
        updatedAt,
      }),
    )
  },
})

export const upsertBatch = mutation({
  args: { records: v.array(v.object(record)), ...syncSecretArg },
  handler: async (ctx, { records, syncSecret }) => {
    requireSyncSecret(ctx, syncSecret)
    // Only the most recent record in the batch can matter — it's a singleton.
    const rec = [...records].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).at(-1)
    if (!rec) return
    const existing = await ctx.db
      .query('benchmark')
      .withIndex('by_key', (q) => q.eq('key', BENCHMARK_SINGLETON_KEY))
      .unique()
    if (existing) {
      if (rec.updatedAt > existing.updatedAt) await ctx.db.patch(existing._id, rec)
    } else {
      await ctx.db.insert('benchmark', { key: BENCHMARK_SINGLETON_KEY, ...rec })
    }
    await touchSyncState(ctx, 'benchmark', rec.updatedAt)
  },
})
