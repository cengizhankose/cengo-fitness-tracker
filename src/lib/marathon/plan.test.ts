import { describe, expect, it } from 'vitest'
import { marathonPlan, allPlannedWorkouts } from './plan'
import { PACE_ZONE_KEYS } from './zones'
import { parseLocalISODate, addDays } from '@/lib/dates'
import type { DayName } from '@/types/plan'

const DAY_TO_INDEX: Record<DayName, number> = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
}

describe('marathonPlan meta', () => {
  it('carries the verified calendar facts', () => {
    expect(marathonPlan.meta.startDate).toBe('2026-08-31')
    expect(marathonPlan.meta.raceDate).toBe('2026-11-01')
    expect(marathonPlan.meta.raceDistanceKm).toBe(42.2)
    expect(marathonPlan.meta.totalWeeks).toBe(9)
  })

  it('exposes the pace zone keys', () => {
    expect(marathonPlan.meta.paceZoneKeys).toEqual(PACE_ZONE_KEYS)
  })

  it('has exactly 3 nutrition phases, contiguous, covering the whole plan', () => {
    const phases = marathonPlan.meta.nutritionPhases
    expect(phases).toHaveLength(3)
    expect(phases[0]?.key).toBe('CUT')
    expect(phases[0]?.startDate).toBe('2026-08-31')
    expect(phases[1]?.key).toBe('MAINTENANCE_TRANSITION')
    expect(phases[2]?.key).toBe('PERFORMANCE')
    expect(phases[2]?.endDate).toBe('2026-11-01')
    for (let i = 1; i < phases.length; i++) {
      expect(phases[i]?.startDate).toBe(addDays(phases[i - 1]!.endDate, 1))
    }
    // boundaries land on week edges
    expect(phases[0]?.endDate).toBe(marathonPlan.weeks[5]?.endDate) // W6 end
    expect(phases[1]?.startDate).toBe(marathonPlan.weeks[6]?.startDate) // W7 start
    expect(phases[1]?.endDate).toBe(marathonPlan.weeks[6]?.endDate) // W7 end
    expect(phases[2]?.startDate).toBe(marathonPlan.weeks[7]?.startDate) // W8 start
  })
})

describe('marathonPlan.weeks structure', () => {
  it('has 9 weeks of 7 days, dates matching startDate + offset', () => {
    expect(marathonPlan.weeks).toHaveLength(9)
    marathonPlan.weeks.forEach((week) => {
      expect(week.days).toHaveLength(7)
      week.days.forEach((day, j) => {
        expect(day.date).toBe(addDays(week.startDate, j))
      })
    })
  })

  it('every startDate is a Monday, every endDate a Sunday', () => {
    marathonPlan.weeks.forEach((week) => {
      expect(parseLocalISODate(week.startDate).getDay()).toBe(1)
      expect(parseLocalISODate(week.endDate).getDay()).toBe(0)
    })
  })

  it('weekday name agrees with the date for every day', () => {
    marathonPlan.weeks.forEach((week) => {
      week.days.forEach((day) => {
        expect(DAY_TO_INDEX[day.dayName]).toBe(parseLocalISODate(day.date).getDay() === 0 ? 6 : parseLocalISODate(day.date).getDay() - 1)
      })
    })
  })

  it('per-week distance total lands inside the stated band for W1-W8', () => {
    marathonPlan.weeks.slice(0, 8).forEach((week) => {
      const total = week.days.reduce((sum, d) => sum + (d.targetDistanceKm ?? 0), 0)
      expect(week.targetVolumeKm).not.toBeNull()
      expect(total).toBeGreaterThanOrEqual(week.targetVolumeKm!.min)
      expect(total).toBeLessThanOrEqual(week.targetVolumeKm!.max)
    })
  })

  it('week 9 has no band and totals 65.2 km; plan totals 433.2 km', () => {
    const w9 = marathonPlan.weeks[8]!
    expect(w9.targetVolumeKm).toBeNull()
    const w9Total = w9.days.reduce((sum, d) => sum + (d.targetDistanceKm ?? 0), 0)
    expect(Math.round(w9Total * 10) / 10).toBe(65.2)

    const grand = marathonPlan.weeks.reduce(
      (sum, w) => sum + w.days.reduce((s, d) => s + (d.targetDistanceKm ?? 0), 0),
      0,
    )
    expect(Math.round(grand * 10) / 10).toBe(433.2)
  })

  it('long runs follow the specified series and W9 Sunday is RACE', () => {
    const longRuns = marathonPlan.weeks.map((w) => w.longRunKm)
    expect(longRuns).toEqual([16, 19, 22, 24, 18, 28, 30, 19, 42.2])
    const w9Sunday = marathonPlan.weeks[8]!.days[6]!
    expect(w9Sunday.workoutType).toBe('RACE')
    expect(w9Sunday.targetDistanceKm).toBe(42.2)
  })

  it('follows the type skeleton [REST, STRIDES, quality, EASY, REST, EASY, LONG_RUN|RACE]', () => {
    marathonPlan.weeks.forEach((week, i) => {
      const types = week.days.map((d) => d.workoutType)
      expect(types[0]).toBe('REST')
      expect(types[1]).toBe('STRIDES')
      expect(['THRESHOLD', 'MARATHON_PACE']).toContain(types[2])
      expect(types[3]).toBe('EASY')
      expect(types[4]).toBe('REST')
      expect(types[5]).toBe('EASY')
      expect(types[6]).toBe(i === 8 ? 'RACE' : 'LONG_RUN')
    })
  })

  it('every paceZone is a valid zone key or null; REST days have null zone and null distance', () => {
    marathonPlan.weeks.forEach((week) => {
      week.days.forEach((day) => {
        if (day.paceZone !== null) expect(PACE_ZONE_KEYS).toContain(day.paceZone)
        if (day.workoutType === 'REST') {
          expect(day.paceZone).toBeNull()
          expect(day.targetDistanceKm).toBeNull()
        }
      })
    })
  })

  it('has no literal pace string anywhere in the plan', () => {
    expect(JSON.stringify(marathonPlan)).not.toMatch(/\d{1,2}:\d{2}\s*\/\s*km/)
  })
})

describe('allPlannedWorkouts', () => {
  it('flattens to 63 strictly-ascending, deduplicated, bounded days', () => {
    const flat = allPlannedWorkouts(marathonPlan)
    expect(flat).toHaveLength(63)
    expect(flat[0]?.date).toBe('2026-08-31')
    expect(flat[62]?.date).toBe('2026-11-01')
    const dates = flat.map((w) => w.date)
    expect(new Set(dates).size).toBe(63)
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]! > dates[i - 1]!).toBe(true)
    }
  })
})
