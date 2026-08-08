import { formatDuration, parseDurationToSec } from '@/lib/format'

/** The benchmark is a 5K by definition — no other distance is a benchmark. */
export const BENCHMARK_DISTANCE_KM = 5

/** Faster than any human 5K — a value below this is a typo, not a run. */
export const BENCHMARK_MIN_SEC = 600 // 10:00
/** Slowest plausible 5K for this plan. */
export const BENCHMARK_MAX_SEC = 5400 // 90:00

export const BENCHMARK_TIME_FORMAT_ERROR = 'Enter your 5K time as mm:ss (e.g. 24:30)'
export const BENCHMARK_TIME_RANGE_ERROR = `Time must be between ${formatDuration(
  BENCHMARK_MIN_SEC,
)} and ${formatDuration(BENCHMARK_MAX_SEC)}`

export type BenchmarkTimeResult = { ok: true; sec: number } | { ok: false; error: string }

/** A benchmark is only a benchmark at exactly 5 km. */
export function isBenchmarkDistance(km: unknown): km is number {
  return km === BENCHMARK_DISTANCE_KM
}

/** The single rule the form and the store both check before anything is persisted. */
export function isValidBenchmarkSec(sec: unknown): sec is number {
  return (
    typeof sec === 'number' &&
    Number.isInteger(sec) &&
    sec >= BENCHMARK_MIN_SEC &&
    sec <= BENCHMARK_MAX_SEC
  )
}

/** "24:30" -> 1470s, or a user-facing reason why it is not a usable 5K time. */
export function parseBenchmarkTime(input: string): BenchmarkTimeResult {
  const raw = input.trim()
  if (!raw) return { ok: false, error: BENCHMARK_TIME_FORMAT_ERROR }

  const sec = parseDurationToSec(raw)
  if (Number.isNaN(sec)) return { ok: false, error: BENCHMARK_TIME_FORMAT_ERROR }
  if (!isValidBenchmarkSec(sec)) return { ok: false, error: BENCHMARK_TIME_RANGE_ERROR }

  return { ok: true, sec }
}
