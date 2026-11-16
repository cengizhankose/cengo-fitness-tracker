import type { PersistedState } from '@/store'
import type { MergeReport } from '@/lib/backup/merge'

export type SliceKey = 'checklist' | 'checkIns' | 'strength' | 'run'

export interface SliceChange {
  key: SliceKey
  label: string
  added: number
  updated: number
  removed: number
  /** Incoming entries skipped because a differing local entry holds the same id. */
  conflicts: number
}

const SLICE_LABEL: Record<SliceKey, string> = {
  checklist: 'Günlük işaretler',
  checkIns: 'Tartı ve ölçü',
  strength: 'Kuvvet kayıtları',
  run: 'Koşular',
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a).filter((k) => (a as Record<string, unknown>)[k] !== undefined)
  const kb = Object.keys(b).filter((k) => (b as Record<string, unknown>)[k] !== undefined)
  if (ka.length !== kb.length) return false
  return ka.every((k) =>
    deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  )
}

function diff(
  before: Map<string, unknown>,
  after: Map<string, unknown>,
): Pick<SliceChange, 'added' | 'updated' | 'removed'> {
  let added = 0
  let updated = 0
  let removed = 0
  for (const [id, value] of after) {
    if (!before.has(id)) added++
    else if (!deepEqual(before.get(id), value)) updated++
  }
  for (const id of before.keys()) if (!after.has(id)) removed++
  return { added, updated, removed }
}

const byId = <T extends { id: string }>(log: T[]) => new Map(log.map((e) => [e.id, e]))

/**
 * Splits the merge report's totals per data slice by diffing the live state against the
 * previewed result, keyed the same way the merge diffs records (date for day maps, id for
 * logs). Conflicts are attributed by which incoming log carries the id.
 */
export function slicePreview(
  local: PersistedState,
  next: PersistedState,
  incoming: PersistedState,
  report: MergeReport,
): SliceChange[] {
  const incomingStrength = new Set(incoming.strengthLog.map((e) => e.id))
  const incomingRun = new Set(incoming.runLog.map((e) => e.id))
  const changes: Record<SliceKey, Omit<SliceChange, 'key' | 'label'>> = {
    checklist: {
      ...diff(new Map(Object.entries(local.checklist)), new Map(Object.entries(next.checklist))),
      conflicts: 0,
    },
    checkIns: {
      ...diff(new Map(Object.entries(local.checkIns)), new Map(Object.entries(next.checkIns))),
      conflicts: 0,
    },
    strength: {
      ...diff(byId(local.strengthLog), byId(next.strengthLog)),
      conflicts: report.idConflicts.filter((id) => incomingStrength.has(id)).length,
    },
    run: {
      ...diff(byId(local.runLog), byId(next.runLog)),
      conflicts: report.idConflicts.filter((id) => incomingRun.has(id)).length,
    },
  }
  return (Object.keys(changes) as SliceKey[]).map((key) => ({
    key,
    label: SLICE_LABEL[key],
    ...changes[key],
  }))
}
