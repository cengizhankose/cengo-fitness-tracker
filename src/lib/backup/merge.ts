import type { PersistedState } from '@/store'
import { stagedPhotoKey } from './format'
import type {
  BenchmarkResult,
  CheckIn,
  DailyChecklistRecord,
  IsoDate,
  RunLogEntry,
  StrengthLogEntry,
} from '@/types/userData'
import type { MarathonStatusRecord } from '@/types/marathon'

export type ImportMode = 'merge' | 'replace'

export interface MergeOptions {
  mode: ImportMode
  /** Merge mode only: adopt the backup's programStartDate. Replace always takes it. */
  includeSettings: boolean
  /** Photo keys already in IndexedDB. */
  localPhotoKeys: ReadonlySet<string>
  /** Photo keys the backup file carries as decodable blobs. */
  filePhotoKeys: ReadonlySet<string>
  /** Per-import token appended to every staged photo key. */
  stageToken: string
}

/** A blob to write under a brand-new key, leaving the live key untouched. */
export interface PhotoStage {
  /** Key inside the backup file. */
  from: string
  /** Fresh IndexedDB key that cannot collide with anything live. */
  to: string
}

export interface MergeReport {
  added: number
  updated: number
  removed: number
  /** Incoming log entries skipped because an entry with that id already exists locally. */
  idConflicts: string[]
  /** Photo refs dropped because no blob will exist for them anywhere. */
  strippedPhotoRefs: string[]
  /** Blobs to stage from the backup file, each under a new key. */
  photoWrites: PhotoStage[]
  settings: 'kept-local' | 'took-incoming'
  benchmark: 'kept-local' | 'took-incoming' | 'none'
}

export interface MergeResult {
  next: PersistedState
  report: MergeReport
}

type PhotoSource = 'local' | 'incoming'

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b || a === null || b === null) return false
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((v, i) => deepEqual(v, b[i]))
  }
  if (typeof a !== 'object') return false
  const ao = a as Record<string, unknown>
  const bo = b as Record<string, unknown>
  const ak = Object.keys(ao).filter((k) => ao[k] !== undefined)
  const bk = Object.keys(bo).filter((k) => bo[k] !== undefined)
  if (ak.length !== bk.length) return false
  return ak.every((k) => Object.hasOwn(bo, k) && deepEqual(ao[k], bo[k]))
}

function trueCount(rec: DailyChecklistRecord): number {
  return Object.values(rec.items).filter(Boolean).length
}

/**
 * Record-level newest-wins. `items` has no per-key timestamps, so a per-key union
 * would just mean "true always wins" — resurrecting ticks the user deliberately
 * removed. Ties break toward more completed items, then toward local.
 */
function mergeChecklistRecord(
  local: DailyChecklistRecord,
  incoming: DailyChecklistRecord,
): DailyChecklistRecord {
  if (incoming.updatedAt > local.updatedAt) return incoming
  if (incoming.updatedAt < local.updatedAt) return local
  return trueCount(incoming) > trueCount(local) ? incoming : local
}

/** Record-level newest-`updatedAt`-wins, tie -> local. Mirrors `mergeChecklistRecord`. */
function mergeMarathonRecord(
  local: MarathonStatusRecord,
  incoming: MarathonStatusRecord,
): MarathonStatusRecord {
  return incoming.updatedAt > local.updatedAt ? incoming : local
}

const CHECKIN_OPTIONAL_FIELDS = [
  'weightKg',
  'waistCm',
  'chestCm',
  'hipCm',
  'frontPhotoKey',
  'sidePhotoKey',
  'notes',
] as const

/**
 * Field-level sparse merge. CheckIn fields are independent measurements written by
 * two different code paths — ProgressScreen.handleSave writes the four metrics
 * without touching photo keys, attachPhotoRef writes photo keys without touching
 * metrics. Whole-record newest-wins would make those paths destroy each other.
 */
function mergeCheckIn(
  local: CheckIn,
  incoming: CheckIn,
): { value: CheckIn; frontFrom: PhotoSource; sideFrom: PhotoSource } {
  const incomingNewer = incoming.updatedAt > local.updatedAt
  const base = incomingNewer ? incoming : local
  const other = incomingNewer ? local : incoming
  const baseSource: PhotoSource = incomingNewer ? 'incoming' : 'local'
  const otherSource: PhotoSource = incomingNewer ? 'local' : 'incoming'

  const out: CheckIn = { ...base }
  let frontFrom = baseSource
  let sideFrom = baseSource
  for (const field of CHECKIN_OPTIONAL_FIELDS) {
    if (out[field] === undefined && other[field] !== undefined) {
      // Type-safe per-field copy: the union of value types is number | string.
      switch (field) {
        case 'weightKg':
        case 'waistCm':
        case 'chestCm':
        case 'hipCm':
          out[field] = other[field]
          break
        case 'frontPhotoKey':
          out.frontPhotoKey = other.frontPhotoKey
          frontFrom = otherSource
          break
        case 'sidePhotoKey':
          out.sidePhotoKey = other.sidePhotoKey
          sideFrom = otherSource
          break
        case 'notes':
          out.notes = other.notes
          break
      }
    }
  }
  out.createdAt = local.createdAt < incoming.createdAt ? local.createdAt : incoming.createdAt
  out.updatedAt = local.updatedAt > incoming.updatedAt ? local.updatedAt : incoming.updatedAt
  return { value: out, frontFrom, sideFrom }
}

/**
 * Union by id. Entries are immutable (the store only adds and removes), so there is
 * no updatedAt to arbitrate with and createdAt is a creation stamp, not an edit stamp.
 * An id collision therefore means a weak-fallback-id clash or a hand-edited file —
 * overwriting local with a record of unknown provenance isn't justifiable.
 */
function mergeLog<T extends { id: string; createdAt: string }>(
  local: T[],
  incoming: T[],
  idConflicts: string[],
): T[] {
  const byId = new Map(local.map((e) => [e.id, e]))
  for (const entry of incoming) {
    const existing = byId.get(entry.id)
    if (!existing) {
      byId.set(entry.id, entry)
      continue
    }
    if (!deepEqual(existing, entry)) idConflicts.push(entry.id)
  }
  return [...byId.values()].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
  )
}

function mergeBenchmark(
  local: BenchmarkResult | undefined,
  incoming: BenchmarkResult | undefined,
): { value: BenchmarkResult | undefined; outcome: MergeReport['benchmark'] } {
  if (!incoming) return { value: local, outcome: local ? 'kept-local' : 'none' }
  if (!local) return { value: incoming, outcome: 'took-incoming' }
  return incoming.createdAt > local.createdAt
    ? { value: incoming, outcome: 'took-incoming' }
    : { value: local, outcome: 'kept-local' }
}

/** Stable identity for every persisted record, used to diff local vs. next. */
function recordEntries(state: PersistedState): Array<[string, unknown]> {
  const out: Array<[string, unknown]> = []
  for (const [k, v] of Object.entries(state.checklist)) out.push([`checklist:${k}`, v])
  for (const [k, v] of Object.entries(state.checkIns)) out.push([`checkIn:${k}`, v])
  for (const e of state.strengthLog) out.push([`strength:${e.id}`, e])
  for (const e of state.runLog) out.push([`run:${e.id}`, e])
  if (state.benchmark) out.push(['benchmark', state.benchmark])
  if (state.activeSession) out.push(['activeSession', state.activeSession])
  for (const [k, v] of Object.entries(state.marathonStatus)) out.push([`marathon:${k}`, v])
  return out
}

function diffRecords(
  local: PersistedState,
  next: PersistedState,
): { added: number; updated: number; removed: number } {
  const before = new Map(recordEntries(local))
  const after = new Map(recordEntries(next))
  let added = 0
  let updated = 0
  for (const [id, value] of after) {
    if (!before.has(id)) added++
    else if (!deepEqual(before.get(id), value)) updated++
  }
  let removed = 0
  for (const id of before.keys()) if (!after.has(id)) removed++
  return { added, updated, removed }
}

/**
 * Resolve every photo reference in the merged state.
 *
 * A blob from the backup is never written over a live photo key. It is staged
 * under a fresh `#token` key and the merged check-in is repointed at that key, so
 * the two writes commute: if the process dies after the photo write but before the
 * state write, the still-live old state keeps pointing at its own untouched blobs
 * and the staged ones are harmless orphans. Overwriting in place would instead
 * leave the old state showing the *new* photo — silently wrong data.
 *
 * A reference with no blob anywhere is stripped: the app tolerates a missing blob
 * by rendering an empty "Add photo" tile forever and invisibly, whereas a stripped
 * field is honest and lets the user re-add the photo.
 */
function resolvePhotos(
  checkIns: Record<IsoDate, CheckIn>,
  sources: Map<string, { front: PhotoSource; side: PhotoSource }>,
  opts: MergeOptions,
): { checkIns: Record<IsoDate, CheckIn>; photoWrites: PhotoStage[]; stripped: string[] } {
  const staged = new Map<string, string>()
  const stripped: string[] = []
  const out: Record<IsoDate, CheckIn> = {}

  // Each distinct source key gets its own index, so two sources that differ only
  // by an existing `#token` can never reduce to the same destination.
  const stage = (key: string): string => {
    const existing = staged.get(key)
    if (existing) return existing
    const to = stagedPhotoKey(key, opts.stageToken, staged.size)
    staged.set(key, to)
    return to
  }

  for (const [date, checkIn] of Object.entries(checkIns)) {
    const source = sources.get(date) ?? { front: 'incoming' as const, side: 'incoming' as const }
    const next: CheckIn = { ...checkIn }

    for (const slot of ['front', 'side'] as const) {
      const field = slot === 'front' ? 'frontPhotoKey' : 'sidePhotoKey'
      const key = next[field]
      if (key === undefined) continue
      const from = slot === 'front' ? source.front : source.side
      const inFile = opts.filePhotoKeys.has(key)
      const inLocal = opts.localPhotoKeys.has(key)

      if (from === 'incoming' && inFile) {
        next[field] = stage(key)
      } else if (inLocal) {
        // Blob already lives under this key — reference it as-is, write nothing.
      } else if (inFile) {
        // The local record won the field but its blob is gone; recover from the file.
        next[field] = stage(key)
      } else {
        stripped.push(key)
        delete next[field]
      }
    }
    out[date] = next
  }
  return {
    checkIns: out,
    photoWrites: [...staged].map(([from, to]) => ({ from, to })),
    stripped,
  }
}

/** Pure. No I/O, no store access — every subtle rule in the import lives here. */
export function mergeState(
  local: PersistedState,
  incoming: PersistedState,
  opts: MergeOptions,
): MergeResult {
  const idConflicts: string[] = []
  const photoSources = new Map<string, { front: PhotoSource; side: PhotoSource }>()

  let checklist: Record<IsoDate, DailyChecklistRecord>
  let checkIns: Record<IsoDate, CheckIn>
  let strengthLog: StrengthLogEntry[]
  let runLog: RunLogEntry[]
  let benchmark: BenchmarkResult | undefined
  let benchmarkOutcome: MergeReport['benchmark']
  let marathonStatus: Record<IsoDate, MarathonStatusRecord>

  if (opts.mode === 'replace') {
    checklist = { ...incoming.checklist }
    checkIns = { ...incoming.checkIns }
    strengthLog = [...incoming.strengthLog]
    runLog = [...incoming.runLog]
    benchmark = incoming.benchmark
    benchmarkOutcome = incoming.benchmark ? 'took-incoming' : 'none'
    marathonStatus = { ...incoming.marathonStatus }
    for (const date of Object.keys(checkIns)) {
      photoSources.set(date, { front: 'incoming', side: 'incoming' })
    }
  } else {
    checklist = { ...local.checklist }
    for (const [date, rec] of Object.entries(incoming.checklist)) {
      const existing = checklist[date]
      checklist[date] = existing ? mergeChecklistRecord(existing, rec) : rec
    }

    checkIns = { ...local.checkIns }
    for (const date of Object.keys(local.checkIns)) {
      photoSources.set(date, { front: 'local', side: 'local' })
    }
    for (const [date, rec] of Object.entries(incoming.checkIns)) {
      const existing = checkIns[date]
      if (!existing) {
        checkIns[date] = rec
        photoSources.set(date, { front: 'incoming', side: 'incoming' })
        continue
      }
      const merged = mergeCheckIn(existing, rec)
      checkIns[date] = merged.value
      photoSources.set(date, { front: merged.frontFrom, side: merged.sideFrom })
    }

    strengthLog = mergeLog(local.strengthLog, incoming.strengthLog, idConflicts)
    runLog = mergeLog(local.runLog, incoming.runLog, idConflicts)
    const b = mergeBenchmark(local.benchmark, incoming.benchmark)
    benchmark = b.value
    benchmarkOutcome = b.outcome

    marathonStatus = { ...local.marathonStatus }
    for (const [date, rec] of Object.entries(incoming.marathonStatus)) {
      const existing = marathonStatus[date]
      marathonStatus[date] = existing ? mergeMarathonRecord(existing, rec) : rec
    }
  }

  const resolved = resolvePhotos(checkIns, photoSources, opts)

  const takeSettings = opts.mode === 'replace' || opts.includeSettings
  const activeSession =
    opts.mode === 'replace' ? incoming.activeSession : local.activeSession ?? incoming.activeSession
  const next: PersistedState = {
    settings: takeSettings ? incoming.settings : local.settings,
    checklist,
    checkIns: resolved.checkIns,
    strengthLog,
    runLog,
    benchmark,
    activeSession,
    marathonStatus,
    _schemaVersion: local._schemaVersion,
  }

  const diff = diffRecords(local, next)
  return {
    next,
    report: {
      ...diff,
      idConflicts,
      strippedPhotoRefs: resolved.stripped,
      photoWrites: resolved.photoWrites,
      settings: takeSettings ? 'took-incoming' : 'kept-local',
      benchmark: benchmarkOutcome,
    },
  }
}
