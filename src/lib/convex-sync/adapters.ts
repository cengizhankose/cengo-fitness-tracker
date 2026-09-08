// Pure record <-> wire-record transforms. Every synced type is reused as-is from
// src/types except where a field genuinely can't cross the wire unchanged: CheckIn's photo
// keys (local-only) and StrengthLogEntry/RunLogEntry/BenchmarkResult's optional-or-absent
// updatedAt (LWW needs one on every record).
import type {
  CheckIn,
  RunLogEntry,
  StrengthLogEntry,
  BenchmarkResult,
  IsoTimestamp,
} from '@/types/userData'
import type { Activity } from '@/types/activities'
import type { CheckInWire, RunWire, BenchmarkWire } from './types'

/** `updatedAt` when present, else `createdAt`. Strength-log entries only ever get an
 *  updatedAt once they're touched by the session flow; ad-hoc log entries never are. */
export function effectiveUpdatedAt(e: { updatedAt?: IsoTimestamp; createdAt: IsoTimestamp }): IsoTimestamp {
  return e.updatedAt ?? e.createdAt
}

export function checkInToWire(c: CheckIn): CheckInWire {
  return {
    date: c.date,
    weightKg: c.weightKg,
    waistCm: c.waistCm,
    chestCm: c.chestCm,
    hipCm: c.hipCm,
    notes: c.notes,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }
}

export function strengthEntryToWire(e: StrengthLogEntry): StrengthLogEntry & { updatedAt: IsoTimestamp } {
  return { ...e, updatedAt: effectiveUpdatedAt(e) }
}

export function runEntryToWire(e: RunLogEntry): RunWire {
  return { ...e, updatedAt: effectiveUpdatedAt(e) }
}

export function runEntryFromWire(w: RunWire): RunLogEntry {
  return {
    id: w.id,
    date: w.date,
    distanceKm: w.distanceKm,
    durationMin: w.durationMin,
    averagePace: w.averagePace,
    averageHeartRate: w.averageHeartRate,
    maxHeartRate: w.maxHeartRate,
    rpe: w.rpe,
    notes: w.notes,
    scheduleDay: w.scheduleDay,
    createdAt: w.createdAt,
  }
}

export function benchmarkToWire(b: BenchmarkResult): BenchmarkWire {
  return { ...b, updatedAt: effectiveUpdatedAt(b) }
}

export function benchmarkFromWire(w: BenchmarkWire): BenchmarkResult {
  return {
    date: w.date,
    timeSec: w.timeSec,
    averagePace: w.averagePace,
    averageHeartRate: w.averageHeartRate,
    maxHeartRate: w.maxHeartRate,
    notes: w.notes,
    createdAt: w.createdAt,
  }
}

/** Every Activity field that is optional on the wire. Kept as a literal list (rather than
 *  reused elsewhere) so this is the one place that has to change if the shape grows. */
const ACTIVITY_OPTIONAL_KEYS = [
  'movingDurationMin',
  'distanceKm',
  'avgHr',
  'maxHr',
  'calories',
  'aerobicTE',
  'anaerobicTE',
  'trainingLoad',
  'hrZones',
  'splits',
  'strokeSummary',
  'avgCadence',
  'rawNotes',
  'comment',
  'commentGeneratedAt',
  'planAdherence',
  'planRef',
] as const

/**
 * Activities are pull-only: garmin-logan's push_to_convex.py writes them straight into Convex,
 * this app never edits or pushes one back. Its Python side serializes an unset field as JSON
 * `null` rather than omitting the key, which Convex's own client never produces — so unlike
 * the other adapters here, this one has to defend against `null` on every optional field
 * (top-level, and each split's optional `hr`), collapsing it to `undefined` so the rest of the
 * app only ever sees the TS-native "absent" shape.
 */
export function activityFromWire(wire: Record<string, unknown>): Activity {
  const out: Record<string, unknown> = { ...wire }
  for (const key of ACTIVITY_OPTIONAL_KEYS) {
    if (out[key] === null) delete out[key]
  }
  if (Array.isArray(out.splits)) {
    out.splits = (out.splits as Record<string, unknown>[]).map((split) => {
      const { hr, ...rest } = split
      return hr === null ? rest : split
    })
  }
  return out as unknown as Activity
}
