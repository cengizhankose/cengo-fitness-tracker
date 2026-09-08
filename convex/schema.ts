import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import {
  checklistItems,
  dayName,
  marathonStatus,
  strengthSet,
  activityType,
  sportGroup,
  planAdherence,
  hrZoneEntry,
  activitySplit,
  strokeSummaryEntry,
} from './validators'

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

  /** Garmin activities (run/bike/swim/strength), pushed by the garmin-logan Python scripts.
   *  Read-only from this app's perspective — `comment`/`planAdherence`/`planRef` are filled
   *  in later by the Hermes cron job's LLM pass, never by this client. */
  activities: defineTable({
    key: v.string(), // == id
    id: v.string(), // "garmin-<garminId>"
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
