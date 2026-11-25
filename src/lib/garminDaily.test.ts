import { describe, expect, it } from 'vitest'
import type { GarminDaily } from '@/types/garminDaily'
import { asleepByCount, latestRecoveryDay, recoverySummary, weekAverage } from './garminDaily'

function day(date: string, extra: Partial<GarminDaily> = {}): GarminDaily {
  return { date, updatedAt: `${date}T08:00:00.000Z`, ...extra }
}

/** One row per day from `from` for `n` days, each with `extra`. */
function run(from: number, n: number, extra: Partial<GarminDaily>): GarminDaily[] {
  return Array.from({ length: n }, (_, i) => day(`2026-11-${String(from + i).padStart(2, '0')}`, extra))
}

describe('latestRecoveryDay', () => {
  it('picks the most recent day with a recovery metric, ignoring order and rows without one', () => {
    const days = [
      day('2026-11-18', { sleepMin: 420 }),
      day('2026-11-20', { vo2max: 52 }),
      day('2026-11-19', { steps: 9000 }),
    ]
    expect(latestRecoveryDay(days)?.date).toBe('2026-11-19')
  })

  it('is undefined without data', () => {
    expect(latestRecoveryDay([])).toBeUndefined()
  })
})

describe('weekAverage', () => {
  it('averages the 7 days ending on the date and compares with the 7 days before', () => {
    const days = [...run(7, 7, { sleepMin: 400 }), ...run(14, 7, { sleepMin: 420 })]
    expect(weekAverage(days, 'sleepMin', '2026-11-20')).toEqual({ avg: 420, direction: 'up' })
  })

  it('reports a fall, and calls a change within the metric tolerance flat', () => {
    const days = [
      ...run(7, 7, { restingHr: 53, steps: 8200 }),
      ...run(14, 7, { restingHr: 50, steps: 8000 }),
    ]
    expect(weekAverage(days, 'restingHr', '2026-11-20')).toEqual({ avg: 50, direction: 'down' })
    expect(weekAverage(days, 'steps', '2026-11-20')).toEqual({ avg: 8000, direction: 'flat' })
  })

  it('skips days without a value and leaves the direction out without a previous week', () => {
    const days = [day('2026-11-15', { hrvNightAvg: 40 }), day('2026-11-16'), day('2026-11-20', { hrvNightAvg: 50 })]
    expect(weekAverage(days, 'hrvNightAvg', '2026-11-20')).toEqual({ avg: 45 })
  })

  it('is undefined when the window has no value', () => {
    expect(weekAverage([day('2026-11-01', { steps: 5000 })], 'steps', '2026-11-20')).toBeUndefined()
  })
})

describe('asleepByCount', () => {
  it('counts nights asleep before 00:30, including one that starts after midnight', () => {
    const days = [
      day('2026-11-20', { sleepStartLocal: '2026-11-19T23:40' }),
      day('2026-11-19', { sleepStartLocal: '2026-11-19T00:20' }),
      day('2026-11-18', { sleepStartLocal: '2026-11-18T01:10' }),
      day('2026-11-17', { sleepStartLocal: '2026-11-17T00:30' }),
      day('2026-11-16', { steps: 8000 }),
    ]
    expect(asleepByCount(days, '2026-11-20')).toEqual({ onTime: 2, nights: 4 })
  })

  it('looks at the last 7 recorded nights up to the date only', () => {
    const days = [
      ...run(1, 9, {}).map((d) => ({ ...d, sleepStartLocal: `${d.date}T01:00` })),
      day('2026-11-10', { sleepStartLocal: '2026-11-09T23:00' }),
      day('2026-11-11', { sleepStartLocal: '2026-11-10T23:00' }),
    ]
    expect(asleepByCount(days, '2026-11-10')).toEqual({ onTime: 1, nights: 7 })
  })

  it('is undefined without any recorded night', () => {
    expect(asleepByCount([day('2026-11-20', { steps: 100 })], '2026-11-20')).toBeUndefined()
  })
})

describe('recoverySummary', () => {
  it('is undefined for empty input', () => {
    expect(recoverySummary([])).toBeUndefined()
  })

  it('summarises the latest day with only the metrics that have values', () => {
    const latest = day('2026-11-20', { sleepMin: 432, sleepStartLocal: '2026-11-19T23:48' })
    const summary = recoverySummary([day('2026-11-19', { sleepMin: 400, steps: 7000 }), latest])
    expect(summary?.day).toBe(latest)
    expect(summary?.week).toEqual({ sleepMin: { avg: 416 }, steps: { avg: 7000 } })
    expect(summary?.bedtime).toEqual({ onTime: 1, nights: 1 })
  })
})
