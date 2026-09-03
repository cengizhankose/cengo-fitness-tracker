import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { strengthSet } from './validators'
import { touchSyncState, syncSecretArg } from './lib'
import { requireSyncSecret } from './auth'

const record = {
  id: v.string(),
  date: v.string(),
  exerciseName: v.string(),
  sets: v.array(strengthSet),
  sessionId: v.optional(v.string()),
  progressionNote: v.optional(v.string()),
  createdAt: v.string(),
  updatedAt: v.string(), // effective: client sends record.updatedAt ?? record.createdAt
}

export const pull = query({
  args: { updatedSince: v.optional(v.string()), ...syncSecretArg },
  handler: async (ctx, { updatedSince, syncSecret }) => {
    requireSyncSecret(ctx, syncSecret)
    const docs = await ctx.db
      .query('strengthLog')
      .withIndex('by_updatedAt', (q) =>
        updatedSince ? q.gt('updatedAt', updatedSince) : q,
      )
      .collect()
    return docs.map(
      ({ id, date, exerciseName, sets, sessionId, progressionNote, createdAt, updatedAt }) => ({
        id,
        date,
        exerciseName,
        sets,
        sessionId,
        progressionNote,
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
        .query('strengthLog')
        .withIndex('by_key', (q) => q.eq('key', rec.id))
        .unique()
      if (existing) {
        await ctx.db.patch(existing._id, rec)
      } else {
        await ctx.db.insert('strengthLog', { key: rec.id, ...rec })
      }
      if (!latest || rec.updatedAt > latest) latest = rec.updatedAt
    }
    if (latest) await touchSyncState(ctx, 'strengthLog', latest)
  },
})
