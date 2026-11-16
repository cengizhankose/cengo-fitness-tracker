import { describe, expect, it } from 'vitest'
import { plan } from '@/lib/plan'
import {
  goalProgress,
  hasWeightBand,
  latestWeight,
  metricSeries,
  weeklyAverages,
  weeklyChangeKg,
  weightBand,
  weightChartDomain,
  weightSeries,
  type MetricPoint,
  type WeightBand,
} from '@/lib/weight'
import type { CheckIn } from '@/types/userData'

function weighIns(...pairs: Array<[string, number | undefined]>): Record<string, CheckIn> {
  return Object.fromEntries(
    pairs.map(([date, weightKg]) => [date, { date, weightKg, createdAt: `${date}T07:00:00`, updatedAt: `${date}T07:00:00` }]),
  )
}

// Two plan weeks of mid-week weigh-ins (not Mondays only).
const CHECK_INS = weighIns(
  ['2026-11-18', 95.1],
  ['2026-11-16', 95.5],
  ['2026-11-26', 94.4],
  ['2026-11-23', 94.8],
  ['2026-11-20', undefined], // waist-only record
)

describe('weightSeries / metricSeries', () => {
  it('returns one point per day that has the value, oldest first, any weekday', () => {
    expect(weightSeries(CHECK_INS)).toEqual([
      { date: '2026-11-16', value: 95.5 },
      { date: '2026-11-18', value: 95.1 },
      { date: '2026-11-23', value: 94.8 },
      { date: '2026-11-26', value: 94.4 },
    ])
    expect(metricSeries(CHECK_INS, 'waistCm')).toEqual([])
  })

  it('latestWeight is the most recent weigh-in', () => {
    expect(latestWeight(CHECK_INS)).toEqual({ date: '2026-11-26', value: 94.4 })
    expect(latestWeight({})).toBeUndefined()
  })
})

describe('weeklyAverages / weeklyChangeKg', () => {
  it('averages per Monday-keyed week with a count', () => {
    expect(weeklyAverages(CHECK_INS)).toEqual([
      { weekStart: '2026-11-16', avgKg: 95.3, count: 2 },
      { weekStart: '2026-11-23', avgKg: 94.6, count: 2 },
    ])
  })

  it('weekly change is the difference of the last two weekly averages', () => {
    expect(weeklyChangeKg(CHECK_INS)).toBe(-0.7)
    expect(weeklyChangeKg(weighIns(['2026-11-16', 95.5]))).toBeUndefined()
  })
})

describe('goalProgress', () => {
  const goal = plan.goal

  it('measures loss from start and distance to the milestone from the latest weekly average', () => {
    const p = goalProgress(goal, CHECK_INS, '2026-11-27')
    expect(p).toMatchObject({
      startKg: 95.5,
      currentKg: 94.6,
      lostKg: 0.9,
      toMilestoneKg: 4.6,
      milestoneReached: false,
      weeksElapsed: 1,
      expectedLostKg: 0.5,
      onTrack: true,
    })
    expect(p.fraction).toBeCloseTo(0.9 / 5.5)
  })

  it('is off track when behind 0.5 kg/week', () => {
    expect(goalProgress(goal, CHECK_INS, '2026-11-30')).toMatchObject({
      weeksElapsed: 2,
      expectedLostKg: 1,
      onTrack: false,
    })
  })

  it('reports the milestone as reached inside the band', () => {
    expect(goalProgress(goal, weighIns(['2027-02-01', 89.5]), '2027-02-01')).toMatchObject({
      toMilestoneKg: 0,
      milestoneReached: true,
      fraction: 1,
    })
  })

  it('has no current/onTrack before any weigh-in and never negative weeks', () => {
    const p = goalProgress(goal, {}, '2026-11-10')
    expect(p.currentKg).toBeUndefined()
    expect(p.onTrack).toBeUndefined()
    expect(p).toMatchObject({ weeksElapsed: 0, expectedLostKg: 0 })
  })
})

// ---- chart framing (moved from derive.test.ts) ----

const pts = (...values: number[]): MetricPoint[] =>
  values.map((value, i) => ({ date: `2026-06-${String(i + 1).padStart(2, '0')}`, value }))

const band = (start: number, targetLow: number, targetHigh: number): WeightBand => ({ start, targetLow, targetHigh })

const CUT = band(92, 82, 84)

describe('weightBand', () => {
  it('maps the plan goal to start + milestone band', () => {
    expect(weightBand(plan.goal)).toEqual({ start: 95.5, targetLow: 89, targetHigh: 90 })
  })
})

describe('hasWeightBand', () => {
  it('accepts a real band and rejects degenerate or non-finite ones', () => {
    expect(hasWeightBand(CUT)).toBe(true)
    expect(hasWeightBand(band(92, 92, 92))).toBe(false)
    expect(hasWeightBand(band(92, 82, Infinity))).toBe(false)
    expect(hasWeightBand(band(92, NaN, 84))).toBe(false)
  })
})

describe('weightChartDomain', () => {
  it('spans the whole band with zero data', () => {
    expect(weightChartDomain([], CUT)).toEqual([81, 85])
  })

  it('anchors on the start weight without a drawable band, else a safe range', () => {
    expect(weightChartDomain([], band(92, 92, 92))).toEqual([90, 94])
    expect(weightChartDomain([], undefined)).toEqual([0, 4])
  })

  it('keeps sparse data from filling the axis', () => {
    expect(weightChartDomain(pts(90))).toEqual([88, 92])
    expect(weightChartDomain(pts(90.0, 90.1, 90.05))).toEqual([88, 92])
  })

  it('contains the band alongside the readings', () => {
    expect(weightChartDomain(pts(93, 91.2, 88.6), CUT)).toEqual([81, 94])
    expect(weightChartDomain(pts(93, 91.2, 88.6))).toEqual([87, 94])
    expect(weightChartDomain(pts(79.5, 80), CUT)).toEqual([78, 85])
  })

  it('drops the start line rather than flattening the series once at goal', () => {
    expect(weightChartDomain(pts(82.5, 83.1, 83.5), CUT)).toEqual([81, 85])
  })

  it('handles invalid input', () => {
    expect(weightChartDomain(pts(90, NaN, 92))).toEqual([89, 93])
    expect(weightChartDomain(pts(NaN, Infinity))).toEqual([0, 4])
    expect(weightChartDomain(pts(93, 88.6), band(92, 82, Infinity))).toEqual([87, 94])
    expect(weightChartDomain(pts(93, 88.6), band(92, 84, 82))).toEqual([81, 94])
    expect(weightChartDomain(pts(91, 92, 93), band(92, 92, 92))).toEqual([90, 94])
  })

  it('frames the real plan goal with a first weigh-in', () => {
    const [lo, hi] = weightChartDomain(pts(95.5), weightBand(plan.goal))
    expect(lo).toBeLessThanOrEqual(89)
    expect(hi).toBeGreaterThanOrEqual(95.5)
  })
})
