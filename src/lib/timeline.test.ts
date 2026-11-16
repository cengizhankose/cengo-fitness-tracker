import { describe, expect, it } from 'vitest'
import { buildTimeline, filterTimeline } from '@/lib/timeline'
import type { Activity } from '@/types/activities'
import type { CheckIn, RunLogEntry, StrengthLogEntry } from '@/types/userData'

function activity(over: Partial<Activity> & Pick<Activity, 'id' | 'date'>): Activity {
  return {
    garminId: 1,
    type: 'running',
    sportGroup: 'run',
    name: 'Koşu',
    startTimeLocal: `${over.date}T07:00:00`,
    durationMin: 30,
    distanceKm: 5,
    createdAt: `${over.date}T08:00:00`,
    updatedAt: `${over.date}T08:00:00`,
    ...over,
  }
}

function run(over: Partial<RunLogEntry> & Pick<RunLogEntry, 'id' | 'date'>): RunLogEntry {
  return { distanceKm: 6, createdAt: `${over.date}T12:00:00`, ...over }
}

function lift(id: string, exerciseName: string, weightKg: number, reps: number, createdAt: string): StrengthLogEntry {
  return { id, date: createdAt.slice(0, 10), exerciseName, sets: [{ weightKg, reps }], createdAt }
}

const strengthLog: StrengthLogEntry[] = [
  lift('a', 'Machine Chest Press', 40, 10, '2026-11-16T06:20:00.000Z'),
  lift('b', 'Pull Up / Lat Pulldown', 60, 10, '2026-11-16T06:15:00.000Z'),
  lift('c', 'Machine Chest Press', 40, 12, '2026-11-16T06:23:00.000Z'),
]

// Mirrors production: the two `garmin-` runLog entries duplicate Garmin activities.
const runLog: RunLogEntry[] = [
  run({ id: 'garmin-24207602358', date: '2026-09-02', distanceKm: 1.8, averagePace: '38:36' }),
  run({ id: '862cbbd6', date: '2026-09-15', distanceKm: 6 }),
  run({ id: 'garmin-24513581874', date: '2026-09-27', distanceKm: 2.36, averagePace: '29:56' }),
]
const activities: Activity[] = [
  activity({ id: 'garmin-24207602358', date: '2026-09-02', type: 'treadmill_running', distanceKm: 1.8 }),
  activity({ id: 'garmin-24513581874', date: '2026-09-27', distanceKm: 2.36 }),
  activity({ id: 'garmin-swim', date: '2026-09-27', type: 'open_water_swimming', sportGroup: 'swim', startTimeLocal: '2026-09-27T16:00:00' }),
]
const checkIns: Record<string, CheckIn> = {
  '2026-11-16': { date: '2026-11-16', weightKg: 95.5, createdAt: 'x', updatedAt: 'x' },
}

const timeline = buildTimeline({ strengthLog, runLog, activities, checkIns })

describe('buildTimeline', () => {
  it('lists days newest first', () => {
    expect(timeline.map((d) => d.date)).toEqual(['2026-11-16', '2026-09-27', '2026-09-15', '2026-09-02'])
  })

  it('drops garmin- runLog entries in favour of the Garmin activity', () => {
    const all = timeline.flatMap((d) => d.runs.map((r) => r.id))
    expect(all).toEqual(['862cbbd6'])
    const sep2 = timeline.find((d) => d.date === '2026-09-02')!
    expect(sep2.runs).toEqual([])
    expect(sep2.activities.map((a) => a.id)).toEqual(['garmin-24207602358'])
  })

  it('groups strength by canonical exercise in first-logged order with entry ids', () => {
    const day = timeline[0]!
    expect(day.strength.map((g) => g.exerciseName)).toEqual(['Lat Pulldown', 'Machine Chest Press'])
    const press = day.strength[1]!
    expect(press.sets.map((s) => [s.entryId, s.setIndex, s.reps])).toEqual([
      ['a', 0, 10],
      ['c', 0, 12],
    ])
  })

  it("attaches the day's weigh-in and sorts activities newest first", () => {
    expect(timeline[0]!.checkIn?.weightKg).toBe(95.5)
    expect(timeline[1]!.activities.map((a) => a.id)).toEqual(['garmin-swim', 'garmin-24513581874'])
  })
})

describe('filterTimeline', () => {
  it("'all' keeps everything", () => {
    expect(filterTimeline(timeline, 'all')).toEqual(timeline)
  })

  it("'strength' keeps only strength days", () => {
    const days = filterTimeline(timeline, 'strength')
    expect(days.map((d) => d.date)).toEqual(['2026-11-16'])
    expect(days[0]!.checkIn).toBeUndefined()
  })

  it("'run' keeps running activities and manual runs", () => {
    const days = filterTimeline(timeline, 'run')
    expect(days.map((d) => d.date)).toEqual(['2026-09-27', '2026-09-15', '2026-09-02'])
    expect(days[0]!.activities.map((a) => a.id)).toEqual(['garmin-24513581874'])
  })

  it("'other' keeps non-run, non-strength activities", () => {
    const days = filterTimeline(timeline, 'other')
    expect(days.map((d) => d.date)).toEqual(['2026-09-27'])
    expect(days[0]!.activities.map((a) => a.id)).toEqual(['garmin-swim'])
  })
})
