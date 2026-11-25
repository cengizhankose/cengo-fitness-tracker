import type { IsoDate, IsoTimestamp } from './userData'

/**
 * One calendar day of Garmin wellness data, pushed into Convex by garmin-logan's sync_daily.py
 * and pulled read-only into this app. Every measurement is optional: a value Garmin has not got
 * for the day (watch not worn, metric not computed yet) is absent, never 0 or null.
 * Mirrors convex/garminDaily.ts `garminDailyFields`.
 */
export interface GarminDaily {
  date: IsoDate

  // ---- activity ----
  steps?: number
  stepGoal?: number
  /** Distance walked/run over the whole day. */
  distanceKm?: number
  activeKcal?: number
  totalKcal?: number
  /** Garmin intensity minutes: moderate + 2 × vigorous. */
  intensityMin?: number

  // ---- heart / stress ----
  restingHr?: number
  /** Average stress level of the day, 0–100. */
  avgStress?: number
  bodyBatteryHigh?: number
  bodyBatteryLow?: number

  // ---- sleep: the night that ENDED on `date` ----
  sleepMin?: number
  deepSleepMin?: number
  lightSleepMin?: number
  remSleepMin?: number
  awakeMin?: number
  /** Garmin sleep score, 0–100. */
  sleepScore?: number
  /** Local wall-clock "YYYY-MM-DDTHH:mm"; the start is usually on the previous calendar day. */
  sleepStartLocal?: string
  sleepEndLocal?: string

  // ---- HRV, measured during that night ----
  /** Night average in ms. */
  hrvNightAvg?: number
  /** Garmin's 7-day average in ms. */
  hrvWeeklyAvg?: number
  /** Garmin's label as sent: "BALANCED", "UNBALANCED", "LOW", "POOR", ... */
  hrvStatus?: string

  // ---- fitness ----
  vo2max?: number
  /** Training readiness score, 0–100. */
  trainingReadiness?: number
  /** Garmin's training status label as sent: "PRODUCTIVE", "MAINTAINING", "RECOVERY", ... */
  trainingStatus?: string
  /** A weigh-in stored in Garmin Connect for the day. */
  weightKg?: number

  updatedAt: IsoTimestamp
}
