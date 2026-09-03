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
