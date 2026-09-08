import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  activityType,
  sportGroup,
  planAdherence,
  hrZoneEntry,
  activitySplit,
  strokeSummaryEntry,
} from './validators'
import { touchSyncState, syncSecretArg } from './lib'
import { requireSyncSecret } from './auth'

const record = {
  id: v.string(),
  garminId: v.number(),
  type: activityType,
  sportGroup: sportGroup,
  name: v.string(),
  date: v.string(),
  startTimeLocal: v.string(),
  durationMin: v.number(),
  movingDurationMin: v.optional(v.number()),
  distanceKm: v.optional(v.number()),
  avgHr: v.optional(v.number()),
  maxHr: v.optional(v.number()),
  calories: v.optional(v.number()),
  aerobicTE: v.optional(v.number()),
  anaerobicTE: v.optional(v.number()),
  trainingLoad: v.optional(v.number()),
  hrZones: v.optional(v.array(hrZoneEntry)),
  splits: v.optional(v.array(activitySplit)),
  strokeSummary: v.optional(v.array(strokeSummaryEntry)),
  avgCadence: v.optional(v.number()),
  rawNotes: v.optional(v.string()),
  comment: v.optional(v.string()),
  commentGeneratedAt: v.optional(v.string()),
  planAdherence: v.optional(planAdherence),
  planRef: v.optional(v.string()),
  createdAt: v.string(),
  updatedAt: v.string(),
}

export const pull = query({
  args: { updatedSince: v.optional(v.string()), ...syncSecretArg },
  handler: async (ctx, { updatedSince, syncSecret }) => {
    requireSyncSecret(ctx, syncSecret)
    const docs = await ctx.db
      .query('activities')
      .withIndex('by_updatedAt', (q) => (updatedSince ? q.gt('updatedAt', updatedSince) : q))
      .collect()
    return docs.map(
      ({
        id,
        garminId,
        type,
        sportGroup,
        name,
        date,
        startTimeLocal,
        durationMin,
        movingDurationMin,
        distanceKm,
        avgHr,
        maxHr,
        calories,
        aerobicTE,
        anaerobicTE,
        trainingLoad,
        hrZones,
        splits,
        strokeSummary,
        avgCadence,
        rawNotes,
        comment,
        commentGeneratedAt,
        planAdherence,
        planRef,
        createdAt,
        updatedAt,
      }) => ({
        id,
        garminId,
        type,
        sportGroup,
        name,
        date,
        startTimeLocal,
        durationMin,
        movingDurationMin,
        distanceKm,
        avgHr,
        maxHr,
        calories,
        aerobicTE,
        anaerobicTE,
        trainingLoad,
        hrZones,
        splits,
        strokeSummary,
        avgCadence,
        rawNotes,
        comment,
        commentGeneratedAt,
        planAdherence,
        planRef,
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
        .query('activities')
        .withIndex('by_key', (q) => q.eq('key', rec.id))
        .unique()
      if (existing) {
        await ctx.db.patch(existing._id, rec)
      } else {
        await ctx.db.insert('activities', { key: rec.id, ...rec })
      }
      if (!latest || rec.updatedAt > latest) latest = rec.updatedAt
    }
    if (latest) await touchSyncState(ctx, 'activities', latest)
  },
})
