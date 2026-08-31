export const PACE_ZONE_KEYS = ['Easy', 'Marathon', 'Threshold', 'Interval', 'Repetition'] as const
export type PaceZoneKey = (typeof PACE_ZONE_KEYS)[number]
export type PaceZoneTable = Record<PaceZoneKey, string | null>

/** Every zone unresolved. VDOT resolution replaces this table, nothing else. */
export const UNRESOLVED_ZONES: PaceZoneTable = {
  Easy: null,
  Marathon: null,
  Threshold: null,
  Interval: null,
  Repetition: null,
}

/** Reserved; no consumer yet — the seam a future VDOT calculator plugs into. */
export interface PaceZoneSource {
  vdot?: number
}

/** `source` is reserved for the VDOT seam — no resolver reads it yet. */
export function resolvePaceZones(source?: PaceZoneSource): PaceZoneTable {
  void source
  return UNRESOLVED_ZONES
}

export function paceForZone(zone: PaceZoneKey | null, table: PaceZoneTable = UNRESOLVED_ZONES): string | null {
  if (!zone) return null
  return table[zone]
}
