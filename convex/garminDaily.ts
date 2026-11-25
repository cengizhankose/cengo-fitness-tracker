import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { syncSecretArg, touchSyncState } from './lib'
import { requireSyncSecret } from './auth'
import { garminDailyFields } from './validators'

/** The whole table, oldest day first. Small (one row per day), so there is no cursor. */
export const pull = query({
  args: syncSecretArg,
  handler: async (ctx, { syncSecret }) => {
    requireSyncSecret(ctx, syncSecret)
    const docs = await ctx.db.query('garminDaily').withIndex('by_key').collect()
    return docs.map((doc) => {
      // Only the contract fields leave the server: drop Convex's own and the index key.
      const day: Partial<typeof doc> = { ...doc }
      delete day._id
      delete day._creationTime
      delete day.key
      return day
    })
  },
})

/**
 * Replaces each day with the pushed record: a metric Garmin no longer reports for a day must
 * not linger from an earlier push, so this is a replace, not a patch.
 */
export const upsertBatch = mutation({
  args: { records: v.array(v.object(garminDailyFields)), ...syncSecretArg },
  handler: async (ctx, { records, syncSecret }) => {
    requireSyncSecret(ctx, syncSecret)
    let latest: string | undefined
    for (const rec of records) {
      const existing = await ctx.db
        .query('garminDaily')
        .withIndex('by_key', (q) => q.eq('key', rec.date))
        .unique()
      if (existing) await ctx.db.replace(existing._id, { key: rec.date, ...rec })
      else await ctx.db.insert('garminDaily', { key: rec.date, ...rec })
      if (!latest || rec.updatedAt > latest) latest = rec.updatedAt
    }
    if (latest) await touchSyncState(ctx, 'garminDaily', latest)
  },
})
