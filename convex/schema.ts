import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { checklistItems, dayName, marathonStatus, strengthSet } from './validators'

/**
 * Every synced table stores its app-side natural key (a date or a StrengthLogEntry/RunLogEntry
 * id) in `key`, plus an `updatedAt` ISO timestamp used for last-write-wins pull/merge. `key` is
 * unique per table; `updatedAt` is indexed so a client can pull only what changed since its
 * cursor. Photos are never stored here (local-only per architecture decision).
 */
export default defineSchema({
  checklist: defineTable({
    key: v.string(), // == date
    date: v.string(),
    items: checklistItems,
    autoWorkout: v.optional(v.boolean()),
    updatedAt: v.string(),
  })
    .index('by_key', ['key'])
    .index('by_updatedAt', ['updatedAt']),

  checkIns: defineTable({
    key: v.string(), // == date
    date: v.string(),
    weightKg: v.optional(v.number()),
    waistCm: v.optional(v.number()),
    chestCm: v.optional(v.number()),
    hipCm: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index('by_key', ['key'])
    .index('by_updatedAt', ['updatedAt']),

  strengthLog: defineTable({
    key: v.string(), // == id
    id: v.string(),
    date: v.string(),
    exerciseName: v.string(),
    sets: v.array(strengthSet),
    sessionId: v.optional(v.string()),
    progressionNote: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(), // effective: record.updatedAt ?? record.createdAt
  })
    .index('by_key', ['key'])
    .index('by_updatedAt', ['updatedAt']),

  runLog: defineTable({
    key: v.string(), // == id
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
  })
    .index('by_key', ['key'])
    .index('by_updatedAt', ['updatedAt']),

  marathonStatus: defineTable({
    key: v.string(), // == date
    date: v.string(),
    status: marathonStatus,
    notes: v.optional(v.string()),
    updatedAt: v.string(),
  })
    .index('by_key', ['key'])
    .index('by_updatedAt', ['updatedAt']),

  benchmark: defineTable({
    key: v.string(), // constant BENCHMARK_SINGLETON_KEY — at most one row ever exists
    date: v.string(),
    timeSec: v.number(),
    averagePace: v.optional(v.string()),
    averageHeartRate: v.optional(v.number()),
    maxHeartRate: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(), // effective: always createdAt
  })
    .index('by_key', ['key'])
    .index('by_updatedAt', ['updatedAt']),

  /** Per-slice high-water mark, bumped by each slice's upsert mutation. Observability /
   *  a shared bookmark — the client also keeps its own local pull cursor per slice. */
  syncState: defineTable({
    slice: v.string(),
    updatedAt: v.string(),
  }).index('by_slice', ['slice']),
})
