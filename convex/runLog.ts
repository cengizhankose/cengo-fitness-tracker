import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { dayName } from './validators'
import { touchSyncState, syncSecretArg } from './lib'
import { requireSyncSecret } from './auth'

const record = {
  id: v.string(),
  date: v.string(),
  distanceKm: v.number(),
  durationMin: v.optional(v.number()),
  averagePace: v.optional(v.string()),
  averageHeartRate: v.optional(v.number()),
  maxHeartRate: v.optional(v.number()),
  rpe: v.optional(v.number()),
  notes: v.optional(v.string()),
  scheduleDay: v.optional(dayName),
  createdAt: v.string(),
  updatedAt: v.string(), // effective: runs are immutable, so this is always createdAt
}

export const pull = query({
  args: { updatedSince: v.optional(v.string()), ...syncSecretArg },
  handler: async (ctx, { updatedSince, syncSecret }) => {
    requireSyncSecret(ctx, syncSecret)
    const docs = await ctx.db
      .query('runLog')
      .withIndex('by_updatedAt', (q) =>
        updatedSince ? q.gt('updatedAt', updatedSince) : q,
      )
      .collect()
    return docs.map(
      ({
        id,
        date,
        distanceKm,
        durationMin,
        averagePace,
        averageHeartRate,
        maxHeartRate,
        rpe,
        notes,
        scheduleDay,
        createdAt,
        updatedAt,
      }) => ({
        id,
        date,
        distanceKm,
        durationMin,
        averagePace,
        averageHeartRate,
        maxHeartRate,
        rpe,
        notes,
        scheduleDay,
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
    let latest: string | undefined
    for (const rec of records) {
      const existing = await ctx.db
        .query('runLog')
        .withIndex('by_key', (q) => q.eq('key', rec.id))
        .unique()
      if (existing) {
        await ctx.db.patch(existing._id, rec)
      } else {
        await ctx.db.insert('runLog', { key: rec.id, ...rec })
      }
      if (!latest || rec.updatedAt > latest) latest = rec.updatedAt
    }
    if (latest) await touchSyncState(ctx, 'runLog', latest)
  },
})
