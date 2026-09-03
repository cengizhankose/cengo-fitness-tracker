import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { touchSyncState, syncSecretArg } from './lib'
import { requireSyncSecret } from './auth'

// Photo keys (frontPhotoKey / sidePhotoKey) are deliberately excluded: photos are local-only
// (idb-keyval blobs), and a key pointing at a blob that doesn't exist on another device would
// be a dangling reference. The pull-side merge always keeps the local device's own photo keys.
const record = {
  date: v.string(),
  weightKg: v.optional(v.number()),
  waistCm: v.optional(v.number()),
  chestCm: v.optional(v.number()),
  hipCm: v.optional(v.number()),
  notes: v.optional(v.string()),
  createdAt: v.string(),
  updatedAt: v.string(),
}

export const pull = query({
  args: { updatedSince: v.optional(v.string()), ...syncSecretArg },
  handler: async (ctx, { updatedSince, syncSecret }) => {
    requireSyncSecret(ctx, syncSecret)
    const docs = await ctx.db
      .query('checkIns')
      .withIndex('by_updatedAt', (q) =>
        updatedSince ? q.gt('updatedAt', updatedSince) : q,
      )
      .collect()
    return docs.map(({ date, weightKg, waistCm, chestCm, hipCm, notes, createdAt, updatedAt }) => ({
      date,
      weightKg,
      waistCm,
      chestCm,
      hipCm,
      notes,
      createdAt,
      updatedAt,
    }))
  },
})

export const upsertBatch = mutation({
  args: { records: v.array(v.object(record)), ...syncSecretArg },
  handler: async (ctx, { records, syncSecret }) => {
    requireSyncSecret(ctx, syncSecret)
    let latest: string | undefined
    for (const rec of records) {
      const existing = await ctx.db
        .query('checkIns')
        .withIndex('by_key', (q) => q.eq('key', rec.date))
        .unique()
      if (existing) {
        await ctx.db.patch(existing._id, rec)
      } else {
        await ctx.db.insert('checkIns', { key: rec.date, ...rec })
      }
      if (!latest || rec.updatedAt > latest) latest = rec.updatedAt
    }
    if (latest) await touchSyncState(ctx, 'checkIns', latest)
  },
})
