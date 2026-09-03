import { describe, it, expect } from 'vitest'
import {
  effectiveUpdatedAt,
  checkInToWire,
  strengthEntryToWire,
  runEntryToWire,
  runEntryFromWire,
  benchmarkToWire,
  benchmarkFromWire,
} from './adapters'
import type { CheckIn, RunLogEntry, StrengthLogEntry, BenchmarkResult } from '@/types/userData'

describe('effectiveUpdatedAt', () => {
  it('prefers updatedAt when present', () => {
    expect(effectiveUpdatedAt({ updatedAt: '2026-01-02T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z' })).toBe(
      '2026-01-02T00:00:00.000Z',
    )
  })

  it('falls back to createdAt when updatedAt is absent', () => {
    expect(effectiveUpdatedAt({ createdAt: '2026-01-01T00:00:00.000Z' })).toBe('2026-01-01T00:00:00.000Z')
  })
})

describe('checkInToWire', () => {
  it('strips local-only photo keys', () => {
    const checkIn: CheckIn = {
      date: '2026-01-01',
      weightKg: 80,
      frontPhotoKey: 'photo:2026-01-01:front',
      sidePhotoKey: 'photo:2026-01-01:side',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const wire = checkInToWire(checkIn)
    expect(wire).not.toHaveProperty('frontPhotoKey')
    expect(wire).not.toHaveProperty('sidePhotoKey')
    expect(wire.weightKg).toBe(80)
    expect(wire.date).toBe('2026-01-01')
  })
})

describe('strengthEntryToWire', () => {
  it('coalesces a missing updatedAt to createdAt', () => {
    const entry: StrengthLogEntry = {
      id: 'e1',
      date: '2026-01-01',
      exerciseName: 'Bench Press',
      sets: [{ weightKg: 60, reps: 8 }],
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    expect(strengthEntryToWire(entry).updatedAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('keeps an explicit updatedAt', () => {
    const entry: StrengthLogEntry = {
      id: 'e1',
      date: '2026-01-01',
      exerciseName: 'Bench Press',
      sets: [{ weightKg: 60, reps: 8 }],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    }
    expect(strengthEntryToWire(entry).updatedAt).toBe('2026-01-02T00:00:00.000Z')
  })
})

describe('runEntryToWire / runEntryFromWire', () => {
  const entry: RunLogEntry = {
    id: 'r1',
    date: '2026-01-01',
    distanceKm: 5,
    createdAt: '2026-01-01T00:00:00.000Z',
  }

  it('stamps updatedAt = createdAt on the way out', () => {
    expect(runEntryToWire(entry).updatedAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('round-trips back to a plain RunLogEntry without an updatedAt field', () => {
    const back = runEntryFromWire(runEntryToWire(entry))
    expect(back).toEqual(entry)
    expect(back).not.toHaveProperty('updatedAt')
  })
})

describe('benchmarkToWire / benchmarkFromWire', () => {
  const benchmark: BenchmarkResult = {
    date: '2026-01-01',
    timeSec: 1200,
    createdAt: '2026-01-01T00:00:00.000Z',
  }

  it('stamps updatedAt = createdAt on the way out', () => {
    expect(benchmarkToWire(benchmark).updatedAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('round-trips back to a plain BenchmarkResult without an updatedAt field', () => {
    const back = benchmarkFromWire(benchmarkToWire(benchmark))
    expect(back).toEqual(benchmark)
    expect(back).not.toHaveProperty('updatedAt')
  })
})
