import { describe, expect, it } from 'vitest'
import {
  BENCHMARK_MAX_SEC,
  BENCHMARK_MIN_SEC,
  BENCHMARK_TIME_FORMAT_ERROR,
  BENCHMARK_TIME_RANGE_ERROR,
  isValidBenchmarkSec,
  parseBenchmarkTime,
} from '@/lib/benchmark'

describe('parseBenchmarkTime', () => {
  it('rejects an empty time', () => {
    expect(parseBenchmarkTime('')).toEqual({ ok: false, error: BENCHMARK_TIME_FORMAT_ERROR })
    expect(parseBenchmarkTime('   ')).toEqual({ ok: false, error: BENCHMARK_TIME_FORMAT_ERROR })
  })

  it('rejects a malformed time', () => {
    for (const input of ['abc', '24', '24:', '24:99', '24,30', '-24:30']) {
      expect(parseBenchmarkTime(input), input).toEqual({
        ok: false,
        error: BENCHMARK_TIME_FORMAT_ERROR,
      })
    }
  })

  it('accepts a valid time', () => {
    expect(parseBenchmarkTime('24:30')).toEqual({ ok: true, sec: 1470 })
    expect(parseBenchmarkTime(' 24:30 ')).toEqual({ ok: true, sec: 1470 })
  })

  it('enforces the range boundaries', () => {
    expect(parseBenchmarkTime('09:59')).toEqual({ ok: false, error: BENCHMARK_TIME_RANGE_ERROR })
    expect(parseBenchmarkTime('10:00')).toEqual({ ok: true, sec: BENCHMARK_MIN_SEC })
    expect(parseBenchmarkTime('90:00')).toEqual({ ok: true, sec: BENCHMARK_MAX_SEC })
    expect(parseBenchmarkTime('90:01')).toEqual({ ok: false, error: BENCHMARK_TIME_RANGE_ERROR })
    expect(parseBenchmarkTime('00:00')).toEqual({ ok: false, error: BENCHMARK_TIME_RANGE_ERROR })
  })
})

describe('isValidBenchmarkSec', () => {
  it('accepts integers inside the range', () => {
    expect(isValidBenchmarkSec(1470)).toBe(true)
    expect(isValidBenchmarkSec(BENCHMARK_MIN_SEC)).toBe(true)
    expect(isValidBenchmarkSec(BENCHMARK_MAX_SEC)).toBe(true)
  })

  it('rejects everything else', () => {
    for (const value of [0, -1, NaN, Infinity, 1470.5, 599, 5401, '1470', null, undefined, {}]) {
      expect(isValidBenchmarkSec(value), String(value)).toBe(false)
    }
  })
})
