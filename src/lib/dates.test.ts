import { describe, expect, it } from 'vitest'
import {
  DAY_LABEL_TR,
  DAY_SHORT_TR,
  dayNameOf,
  formatDayMonth,
  formatLongDate,
  formatShortDate,
  mondayOf,
  weekDates,
} from '@/lib/dates'

describe('weekday helpers', () => {
  it('names the weekday of a date', () => {
    expect(dayNameOf('2026-11-16')).toBe('Monday')
    expect(dayNameOf('2026-11-22')).toBe('Sunday')
  })

  it('lists Monday..Sunday of the week', () => {
    expect(weekDates('2026-11-22')).toEqual([
      '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22',
    ])
    expect(mondayOf('2026-11-22')).toBe('2026-11-16')
  })

  it('has Turkish labels', () => {
    expect(DAY_LABEL_TR.Wednesday).toBe('Çarşamba')
    expect(DAY_SHORT_TR.Saturday).toBe('Cmt')
  })
})

describe('Turkish date formatting', () => {
  it('formats short, day-month and long forms', () => {
    expect(formatShortDate('2026-11-16')).toBe('Pzt 16 Kas')
    expect(formatDayMonth('2026-11-16')).toBe('16 Kas')
    expect(formatLongDate('2026-11-16')).toBe('16 Kasım Pazartesi')
    expect(formatLongDate('2027-02-08')).toBe('8 Şubat Pazartesi')
  })
})
