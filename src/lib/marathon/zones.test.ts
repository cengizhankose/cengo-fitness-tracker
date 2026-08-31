import { describe, expect, it } from 'vitest'
import { PACE_ZONE_KEYS, UNRESOLVED_ZONES, resolvePaceZones, paceForZone } from './zones'

describe('PACE_ZONE_KEYS', () => {
  it('is the exact zone-key set, in order', () => {
    expect(PACE_ZONE_KEYS).toEqual(['Easy', 'Marathon', 'Threshold', 'Interval', 'Repetition'])
  })
})

describe('resolvePaceZones', () => {
  it('returns every zone as null — the VDOT seam has no resolver yet', () => {
    expect(resolvePaceZones()).toEqual(UNRESOLVED_ZONES)
  })

  it('ignores a source argument today', () => {
    expect(resolvePaceZones({ vdot: 50 })).toEqual(UNRESOLVED_ZONES)
  })
})

describe('paceForZone', () => {
  it('returns null for a real zone key while unresolved', () => {
    expect(paceForZone('Threshold')).toBeNull()
  })

  it('returns null for a null zone', () => {
    expect(paceForZone(null)).toBeNull()
  })

  it('looks the key up in a provided table', () => {
    const table = { ...UNRESOLVED_ZONES, Easy: '5:45/km' }
    expect(paceForZone('Easy', table)).toBe('5:45/km')
    expect(paceForZone('Threshold', table)).toBeNull()
  })
})
