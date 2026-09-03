import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { marathonStatus as marathonStatusValue } from './validators'
import { touchSyncState, syncSecretArg } from './lib'
import { requireSyncSecret } from './auth'

const record = {
  date: v.string(),
  status: marathonStatusValue,
  notes: v.optional(v.string()),
  updatedAt: v.string(),
}

export const pull = query({
  args: { updatedSince: v.optional(v.string()), ...syncSecretArg },
  handler: async (ctx, { updatedSince, syncSecret }) => {
    requireSyncSecret(ctx, syncSecret)
    const docs = await ctx.db
      .query('marathonStatus')
      .withIndex('by_updatedAt', (q) =>
        updatedSince ? q.gt('updatedAt', updatedSince) : q,
      )
      .collect()
    return docs.map(({ date, status, notes, updatedAt }) => ({ date, status, notes, updatedAt }))
  },
})

export const upsertBatch = mutation({
  args: { records: v.array(v.object(record)), ...syncSecretArg },
  handler: async (ctx, { records, syncSecret }) => {
    requireSyncSecret(ctx, syncSecret)
    let latest: string | undefined
    for (const rec of records) {
      const existing = await ctx.db
        .query('marathonStatus')
        .withIndex('by_key', (q) => q.eq('key', rec.date))
        .unique()
      if (existing) {
        await ctx.db.patch(existing._id, rec)
      } else {
        await ctx.db.insert('marathonStatus', { key: rec.date, ...rec })
      }
      if (!latest || rec.updatedAt > latest) latest = rec.updatedAt
    }
    if (latest) await touchSyncState(ctx, 'marathonStatus', latest)
  },
})
