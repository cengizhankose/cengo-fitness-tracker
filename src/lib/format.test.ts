import { describe, expect, it } from 'vitest'
import { formatDuration, parseDurationToSec } from '@/lib/format'

describe('parseDurationToSec', () => {
  it('parses mm:ss', () => {
    expect(parseDurationToSec('24:30')).toBe(1470)
    expect(parseDurationToSec('9:05')).toBe(545)
    expect(parseDurationToSec('00:00')).toBe(0)
    expect(parseDurationToSec('120:59')).toBe(7259)
  })

  it('rejects malformed input', () => {
    for (const input of ['', '   ', '24', '24:', ':30', 'abc', '-1:00', '24:5', '24.5', '1:2:3']) {
      expect(parseDurationToSec(input), input).toBeNaN()
    }
  })

  it('rejects seconds outside 00-59', () => {
    expect(parseDurationToSec('22:99')).toBeNaN()
    expect(parseDurationToSec('22:60')).toBeNaN()
    expect(parseDurationToSec('22:59')).toBe(1379)
  })

  it('round-trips with formatDuration', () => {
    expect(formatDuration(parseDurationToSec('24:30'))).toBe('24:30')
  })
})
