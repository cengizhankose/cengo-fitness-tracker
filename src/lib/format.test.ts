import { describe, expect, it } from 'vitest'
import {
  formatDuration,
  formatMinPlus,
  formatNumber,
  formatRange,
  formatSet,
  formatSetsReps,
  kg,
  pace,
} from '@/lib/format'

describe('formatNumber / kg', () => {
  it('uses tr-TR separators', () => {
    expect(formatNumber(82.5)).toBe('82,5')
    expect(formatNumber(8000)).toBe('8.000')
    expect(formatNumber(1.25, 2)).toBe('1,25')
    expect(kg(82.5)).toBe('82,5 kg')
    expect(kg(undefined)).toBe('—')
  })
})

describe('formatSet', () => {
  it('formats weight × reps for kg exercises', () => {
    expect(formatSet({ weightKg: 80, reps: 5 }, 'kg')).toBe('80 kg × 5')
    expect(formatSet({ weightKg: 42.5, reps: 12 })).toBe('42,5 kg × 12')
  })

  it('formats bodyweight work as reps, or added load', () => {
    expect(formatSet({ weightKg: 0, reps: 5 }, 'bodyweight')).toBe('5 tekrar')
    expect(formatSet({ weightKg: 10, reps: 5 }, 'bodyweight')).toBe('+10 kg × 5')
  })

  it('formats timed work as seconds', () => {
    expect(formatSet({ weightKg: 0, reps: 45 }, 'seconds')).toBe('45 sn')
  })
})

describe('formatSetsReps', () => {
  it('formats the plan prescription', () => {
    expect(formatSetsReps(1, 5, 'kg')).toBe('1 × 5')
    expect(formatSetsReps(1, 'max', 'bodyweight')).toBe('1 × max')
    expect(formatSetsReps(2, 45, 'seconds')).toBe('2 × 45 sn')
  })
})

describe('ranges and durations', () => {
  it('formats ranges and minimums', () => {
    expect(formatRange({ min: 12, max: 14 }, 'km')).toBe('12–14 km')
    expect(formatRange({ min: 300, max: 300 }, 'kcal')).toBe('300 kcal')
    expect(formatMinPlus(8000)).toBe('8.000+')
  })

  it('formats durations and pace', () => {
    expect(formatDuration(1470)).toBe('24:30')
    expect(pace(10, 55)).toBe('5:30/km')
    expect(pace(0, 30)).toBe('—')
  })
})
