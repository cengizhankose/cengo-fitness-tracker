import { describe, it, expect } from 'vitest'
import { weightChartDomain, hasWeightBand } from '@/lib/derive'
import type { MetricPoint, WeightGoal } from '@/lib/derive'

const pts = (...values: number[]): MetricPoint[] =>
  values.map((value, i) => ({ date: `2026-06-${String(i + 1).padStart(2, '0')}`, value }))

const goal = (start: number, targetLow: number, targetHigh: number): WeightGoal => ({
  start,
  targetLow,
  targetHigh,
})

const CUT = goal(92, 82, 84) // "92kg -> 82-84kg" from plan.json

describe('hasWeightBand', () => {
  it('accepts a real two-sided band', () => {
    expect(hasWeightBand(CUT)).toBe(true)
  })

  it('rejects the degenerate start===target fallback goal', () => {
    expect(hasWeightBand(goal(92, 92, 92))).toBe(false)
  })

  it('rejects non-finite bounds', () => {
    expect(hasWeightBand(goal(92, 82, Infinity))).toBe(false)
    expect(hasWeightBand(goal(92, NaN, 84))).toBe(false)
  })
})

describe('weightChartDomain', () => {
  describe('zero data', () => {
    it('still spans the whole target band so it can be drawn', () => {
      const [lo, hi] = weightChartDomain([], CUT)
      expect(lo).toBeLessThanOrEqual(CUT.targetLow)
      expect(hi).toBeGreaterThanOrEqual(CUT.targetHigh)
      expect([lo, hi]).toEqual([81, 85])
    })

    it('anchors on the start weight when the goal has no drawable band', () => {
      expect(weightChartDomain([], goal(92, 92, 92))).toEqual([90, 94])
    })

    it('falls back to a safe finite range with no goal at all', () => {
      expect(weightChartDomain([], undefined)).toEqual([0, 4])
    })
  })

  describe('sparse data', () => {
    it('keeps a single point from filling the whole axis', () => {
      expect(weightChartDomain(pts(90))).toEqual([88, 92])
    })

    it('does not magnify noise in near-constant readings', () => {
      expect(weightChartDomain(pts(90.0, 90.1, 90.05))).toEqual([88, 92])
    })

    it('covers the band even from a single far-away point', () => {
      const [lo, hi] = weightChartDomain(pts(93), CUT)
      expect(lo).toBeLessThanOrEqual(82)
      expect(hi).toBeGreaterThanOrEqual(93)
    })
  })

  describe('full data', () => {
    it('contains the 82-84 band alongside 88.6-93 readings (the reported bug)', () => {
      expect(weightChartDomain(pts(93, 91.2, 88.6), CUT)).toEqual([81, 94])
    })

    it('leaves goal-free charts framed on the data', () => {
      expect(weightChartDomain(pts(93, 91.2, 88.6))).toEqual([87, 94])
    })

    it('handles data below the band', () => {
      expect(weightChartDomain(pts(79.5, 80), CUT)).toEqual([78, 85])
    })

    it('drops the start line rather than flattening the series once at goal', () => {
      const [lo, hi] = weightChartDomain(pts(82.5, 83.1, 83.5), CUT)
      expect([lo, hi]).toEqual([81, 85])
      expect(hi).toBeLessThan(CUT.start)
    })
  })

  describe('invalid and degenerate input', () => {
    it('ignores non-finite data points', () => {
      expect(weightChartDomain(pts(90, NaN, 92))).toEqual([89, 93])
    })

    it('returns a safe range when every point is non-finite', () => {
      expect(weightChartDomain(pts(NaN, Infinity))).toEqual([0, 4])
    })

    it('does not widen the domain for a band it will not draw', () => {
      expect(weightChartDomain(pts(93, 88.6), goal(92, 82, Infinity))).toEqual([87, 94])
    })

    it('tolerates reversed band bounds', () => {
      expect(weightChartDomain(pts(93, 88.6), goal(92, 84, 82))).toEqual([81, 94])
    })

    it('keeps a degenerate goal from distorting the frame', () => {
      expect(weightChartDomain(pts(91, 92, 93), goal(92, 92, 92))).toEqual([90, 94])
    })
  })

  describe('invariants hold for every shape of input', () => {
    const inputs: Array<[string, MetricPoint[], WeightGoal | undefined]> = [
      ['empty, no goal', [], undefined],
      ['empty, cut goal', [], CUT],
      ['empty, degenerate goal', [], goal(92, 92, 92)],
      ['single point', pts(90), CUT],
      ['full series', pts(93, 91.2, 88.6), CUT],
      ['all non-finite', pts(NaN), CUT],
      ['non-finite goal', pts(90), goal(NaN, NaN, NaN)],
      ['reversed band', pts(90), goal(92, 84, 82)],
    ]

    it.each(inputs)('%s -> finite, ordered, integer bounds', (_label, data, g) => {
      const [lo, hi] = weightChartDomain(data, g)
      expect(Number.isFinite(lo)).toBe(true)
      expect(Number.isFinite(hi)).toBe(true)
      expect(Number.isInteger(lo)).toBe(true)
      expect(Number.isInteger(hi)).toBe(true)
      expect(hi - lo).toBeGreaterThanOrEqual(4)
    })
  })
})
