import { SCHEMA_VERSION } from '@/store'
import type { PersistedState } from '@/store'
import type { ChecklistKey, DayName } from '@/types/plan'
import type {
  BenchmarkResult,
  ActiveSession,
  CheckIn,
  DailyChecklist,
  DailyChecklistRecord,
  IsoDate,
  RunLogEntry,
  StrengthLogEntry,
  StrengthSet,
} from '@/types/userData'
import { parseLocalISODate, toLocalISODate } from '@/lib/dates'
import {
  FORMAT_VERSION,
  MAGIC,
  MAX_ID_CHARS,
  MAX_LOG_ENTRIES,
  MAX_MAP_ENTRIES,
  MAX_NAME_CHARS,
  MAX_NOTES_CHARS,
  MAX_PHOTOS,
  MAX_PHOTO_BYTES,
  MAX_SETS_PER_ENTRY,
  MAX_TOTAL_PHOTO_BYTES,
  base64DecodedLength,
  isIsoTimestamp,
  isPhotoKey,
  isSupportedPhotoMime,
  parsePhotoKey,
} from './format'
import type {
  BackupFile,
  BackupPhoto,
  ImportError,
  PhotoSlot,
  Result,
  ValidationIssue,
} from './format'

/** Exhaustive by construction — adding a ChecklistKey without listing it here won't compile. */
const CHECKLIST_KEYS: Record<ChecklistKey, true> = {
  completedWorkout: true,
  completedMorningMobility: true,
  completedStretching: true,
  hitProteinTarget: true,
  hitCalorieTarget: true,
  steps10000Plus: true,
  sleep75Plus: true,
  noAlcohol: true,
}

const DAY_NAMES: Record<DayName, true> = {
  Monday: true,
  Tuesday: true,
  Wednesday: true,
  Thursday: true,
  Friday: true,
  Saturday: true,
  Sunday: true,
}

/** Prototype-pollution guards — these can never be legitimate map keys here. */
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

const MAX_ISSUES_REPORTED = 5
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

class Issues {
  readonly all: ValidationIssue[] = []
  add(path: string, expected: string, got: unknown): void {
    this.all.push({ path, expected, got: describe(got) })
  }
  get failed(): boolean {
    return this.all.length > 0
  }
}

function describe(v: unknown): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return `array(${v.length})`
  if (typeof v === 'string') return v.length > 40 ? `string("${v.slice(0, 40)}…")` : `string("${v}")`
  if (typeof v === 'number') return Number.isFinite(v) ? `number(${v})` : `number(${String(v)})`
  return typeof v
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Civil date that actually exists — `parseLocalISODate` silently yields NaN dates otherwise. */
function isIsoDate(v: unknown): v is IsoDate {
  if (typeof v !== 'string' || !ISO_DATE_RE.test(v)) return false
  return toLocalISODate(parseLocalISODate(v)) === v
}

function isBoundedString(max: number) {
  return (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= max
}

const isName = isBoundedString(MAX_NAME_CHARS)
const isId = isBoundedString(MAX_ID_CHARS)

/** `typeof v === 'number'` is not enough: JSON.parse('{"x":1e999}').x === Infinity. */
function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** Reads an optional field: absent/undefined is fine, present-but-wrong is an issue. */
function optional<T>(
  raw: Record<string, unknown>,
  key: string,
  path: string,
  guard: (v: unknown) => v is T,
  expected: string,
  issues: Issues,
): T | undefined {
  const v = raw[key]
  if (v === undefined || v === null) return undefined
  if (!guard(v)) {
    issues.add(`${path}.${key}`, expected, v)
    return undefined
  }
  return v
}

function optionalNotes(
  raw: Record<string, unknown>,
  path: string,
  issues: Issues,
): string | undefined {
  const v = raw['notes']
  if (v === undefined || v === null) return undefined
  if (typeof v !== 'string') {
    issues.add(`${path}.notes`, 'string', v)
    return undefined
  }
  if (v.length > MAX_NOTES_CHARS) {
    issues.add(`${path}.notes`, `string ≤ ${MAX_NOTES_CHARS} chars`, `string(${v.length} chars)`)
    return undefined
  }
  return v
}

/** Every timestamp the merge orders records by must be a real, canonical ISO instant. */
function requireTimestamp(
  raw: Record<string, unknown>,
  key: string,
  path: string,
  issues: Issues,
): string | undefined {
  const v = raw[key]
  if (!isIsoTimestamp(v)) {
    issues.add(`${path}.${key}`, 'ISO timestamp (YYYY-MM-DDTHH:mm:ss.sssZ)', v)
    return undefined
  }
  return v
}

/**
 * Read a check-in's photo reference, requiring the key's own date and slot to
 * match the record that holds it.
 */
function photoRef(
  raw: Record<string, unknown>,
  field: 'frontPhotoKey' | 'sidePhotoKey',
  slot: PhotoSlot,
  date: IsoDate,
  path: string,
  issues: Issues,
): string | undefined {
  const value = raw[field]
  if (value === undefined || value === null) return undefined
  if (!isPhotoKey(value)) {
    issues.add(`${path}.${field}`, 'photo:YYYY-MM-DD:front|side[#token]', value)
    return undefined
  }
  const parsed = parsePhotoKey(value)
  if (!parsed || parsed.date !== date || parsed.slot !== slot) {
    issues.add(`${path}.${field}`, `key for ${date} / ${slot}`, value)
    return undefined
  }
  return value
}

// ---- collections ----

function validateChecklist(raw: unknown, issues: Issues): Record<IsoDate, DailyChecklistRecord> {
  const out: Record<IsoDate, DailyChecklistRecord> = {}
  if (!isRecord(raw)) {
    issues.add('state.checklist', 'object', raw)
    return out
  }
  const allKeys = Object.keys(raw)
  if (allKeys.length > MAX_MAP_ENTRIES) {
    issues.add('state.checklist', `≤ ${MAX_MAP_ENTRIES} entries`, `${allKeys.length} entries`)
    return out
  }
  for (const key of allKeys) {
    const path = `state.checklist["${key}"]`
    if (FORBIDDEN_KEYS.has(key)) {
      issues.add(path, 'safe map key', key)
      continue
    }
    if (!isIsoDate(key)) {
      issues.add(path, 'YYYY-MM-DD map key', key)
      continue
    }
    const rec = raw[key]
    if (!isRecord(rec)) {
      issues.add(path, 'object', rec)
      continue
    }
    if (rec['date'] !== key) {
      issues.add(`${path}.date`, `"${key}" (must equal map key)`, rec['date'])
      continue
    }
    const updatedAt = requireTimestamp(rec, 'updatedAt', path, issues)
    if (!updatedAt) continue
    const rawItems = rec['items']
    if (!isRecord(rawItems)) {
      issues.add(`${path}.items`, 'object', rawItems)
      continue
    }
    const items: DailyChecklist = {}
    for (const itemKey of Object.keys(rawItems)) {
      // Unknown keys are dropped, not rejected: they'd never render (no CHECKLIST_META
      // entry) but would bloat storage and skew perfectDays().
      if (!Object.hasOwn(CHECKLIST_KEYS, itemKey)) continue
      const value = rawItems[itemKey]
      if (typeof value !== 'boolean') {
        issues.add(`${path}.items.${itemKey}`, 'boolean', value)
        continue
      }
      items[itemKey as ChecklistKey] = value
    }
    out[key] = { date: key, items, updatedAt }
  }
  return out
}

function validateCheckIns(raw: unknown, issues: Issues): Record<IsoDate, CheckIn> {
  const out: Record<IsoDate, CheckIn> = {}
  if (!isRecord(raw)) {
    issues.add('state.checkIns', 'object', raw)
    return out
  }
  const allKeys = Object.keys(raw)
  if (allKeys.length > MAX_MAP_ENTRIES) {
    issues.add('state.checkIns', `≤ ${MAX_MAP_ENTRIES} entries`, `${allKeys.length} entries`)
    return out
  }
  for (const key of allKeys) {
    const path = `state.checkIns["${key}"]`
    if (FORBIDDEN_KEYS.has(key)) {
      issues.add(path, 'safe map key', key)
      continue
    }
    if (!isIsoDate(key)) {
      issues.add(path, 'YYYY-MM-DD map key', key)
      continue
    }
    const rec = raw[key]
    if (!isRecord(rec)) {
      issues.add(path, 'object', rec)
      continue
    }
    if (rec['date'] !== key) {
      issues.add(`${path}.date`, `"${key}" (must equal map key)`, rec['date'])
      continue
    }
    const createdAt = requireTimestamp(rec, 'createdAt', path, issues)
    const updatedAt = requireTimestamp(rec, 'updatedAt', path, issues)
    if (!createdAt || !updatedAt) continue

    const checkIn: CheckIn = { date: key, createdAt, updatedAt }
    const weightKg = optional(rec, 'weightKg', path, isFiniteNumber, 'finite number', issues)
    const waistCm = optional(rec, 'waistCm', path, isFiniteNumber, 'finite number', issues)
    const chestCm = optional(rec, 'chestCm', path, isFiniteNumber, 'finite number', issues)
    const hipCm = optional(rec, 'hipCm', path, isFiniteNumber, 'finite number', issues)
    // Photo keys are taken verbatim (never recomputed), so they must be checked
    // against the record that references them: a key whose date or slot disagrees
    // would attach a different check-in's photo — the exact silent-wrong-data
    // failure the opaque-key rule is meant to avoid.
    const front = photoRef(rec, 'frontPhotoKey', 'front', key, path, issues)
    const side = photoRef(rec, 'sidePhotoKey', 'side', key, path, issues)
    const notes = optionalNotes(rec, path, issues)

    if (weightKg !== undefined) checkIn.weightKg = weightKg
    if (waistCm !== undefined) checkIn.waistCm = waistCm
    if (chestCm !== undefined) checkIn.chestCm = chestCm
    if (hipCm !== undefined) checkIn.hipCm = hipCm
    if (front !== undefined) checkIn.frontPhotoKey = front
    if (side !== undefined) checkIn.sidePhotoKey = side
    if (notes !== undefined) checkIn.notes = notes
    out[key] = checkIn
  }
  return out
}

function validateSets(raw: unknown, path: string, issues: Issues): StrengthSet[] | undefined {
  // derive.ts:245 calls .reduce on this — a non-array crashes render.
  if (!Array.isArray(raw)) {
    issues.add(path, 'array', raw)
    return undefined
  }
  if (raw.length > MAX_SETS_PER_ENTRY) {
    issues.add(path, `≤ ${MAX_SETS_PER_ENTRY} sets`, `array(${raw.length})`)
    return undefined
  }
  const out: StrengthSet[] = []
  for (const [i, rawSet] of raw.entries()) {
    const setPath = `${path}[${i}]`
    if (!isRecord(rawSet)) {
      issues.add(setPath, 'object', rawSet)
      return undefined
    }
    if (!isFiniteNumber(rawSet['weightKg'])) {
      issues.add(`${setPath}.weightKg`, 'finite number', rawSet['weightKg'])
      return undefined
    }
    if (!isFiniteNumber(rawSet['reps'])) {
      issues.add(`${setPath}.reps`, 'finite number', rawSet['reps'])
      return undefined
    }
    const set: StrengthSet = { weightKg: rawSet['weightKg'], reps: rawSet['reps'] }
    const rpe = optional(rawSet, 'rpe', setPath, isFiniteNumber, 'finite number', issues)
    if (rpe !== undefined) set.rpe = rpe
    out.push(set)
  }
  return out
}

function validateStrengthLog(raw: unknown, issues: Issues): StrengthLogEntry[] {
  const out: StrengthLogEntry[] = []
  if (!Array.isArray(raw)) {
    issues.add('state.strengthLog', 'array', raw)
    return out
  }
  if (raw.length > MAX_LOG_ENTRIES) {
    issues.add('state.strengthLog', `≤ ${MAX_LOG_ENTRIES} entries`, `array(${raw.length})`)
    return out
  }
  const seen = new Set<string>()
  for (const [i, rec] of raw.entries()) {
    const path = `state.strengthLog[${i}]`
    if (!isRecord(rec)) {
      issues.add(path, 'object', rec)
      continue
    }
    if (!isId(rec['id'])) {
      issues.add(`${path}.id`, `string ≤ ${MAX_ID_CHARS} chars`, rec['id'])
      continue
    }
    if (!isIsoDate(rec['date'])) {
      issues.add(`${path}.date`, 'YYYY-MM-DD', rec['date'])
      continue
    }
    if (!isName(rec['exerciseName'])) {
      issues.add(`${path}.exerciseName`, `string ≤ ${MAX_NAME_CHARS} chars`, rec['exerciseName'])
      continue
    }
    // derive.ts:244 / LogScreen.tsx:137 sort on createdAt; the merge orders by it too.
    const createdAt = requireTimestamp(rec, 'createdAt', path, issues)
    if (!createdAt) continue
    const sets = validateSets(rec['sets'], `${path}.sets`, issues)
    if (!sets) continue
    if (seen.has(rec['id'])) {
      issues.add(`${path}.id`, 'unique id', rec['id'])
      continue
    }
    seen.add(rec['id'])
    const entry: StrengthLogEntry = {
      id: rec['id'],
      date: rec['date'],
      exerciseName: rec['exerciseName'],
      sets,
      createdAt,
    }
    const note = optional(rec, 'progressionNote', path, isName, 'string', issues)
    if (note !== undefined) entry.progressionNote = note
    out.push(entry)
  }
  return out
}

function validateRunLog(raw: unknown, issues: Issues): RunLogEntry[] {
  const out: RunLogEntry[] = []
  if (!Array.isArray(raw)) {
    issues.add('state.runLog', 'array', raw)
    return out
  }
  if (raw.length > MAX_LOG_ENTRIES) {
    issues.add('state.runLog', `≤ ${MAX_LOG_ENTRIES} entries`, `array(${raw.length})`)
    return out
  }
  const seen = new Set<string>()
  for (const [i, rec] of raw.entries()) {
    const path = `state.runLog[${i}]`
    if (!isRecord(rec)) {
      issues.add(path, 'object', rec)
      continue
    }
    if (!isId(rec['id'])) {
      issues.add(`${path}.id`, `string ≤ ${MAX_ID_CHARS} chars`, rec['id'])
      continue
    }
    if (!isIsoDate(rec['date'])) {
      issues.add(`${path}.date`, 'YYYY-MM-DD', rec['date'])
      continue
    }
    if (!isFiniteNumber(rec['distanceKm'])) {
      issues.add(`${path}.distanceKm`, 'finite number', rec['distanceKm'])
      continue
    }
    const createdAt = requireTimestamp(rec, 'createdAt', path, issues)
    if (!createdAt) continue
    if (seen.has(rec['id'])) {
      issues.add(`${path}.id`, 'unique id', rec['id'])
      continue
    }
    seen.add(rec['id'])
    const entry: RunLogEntry = {
      id: rec['id'],
      date: rec['date'],
      distanceKm: rec['distanceKm'],
      createdAt,
    }
    const durationMin = optional(rec, 'durationMin', path, isFiniteNumber, 'finite number', issues)
    const pace = optional(rec, 'averagePace', path, isName, 'string', issues)
    const avgHr = optional(rec, 'averageHeartRate', path, isFiniteNumber, 'finite number', issues)
    const maxHr = optional(rec, 'maxHeartRate', path, isFiniteNumber, 'finite number', issues)
    const rpe = optional(rec, 'rpe', path, isFiniteNumber, 'finite number', issues)
    const notes = optionalNotes(rec, path, issues)
    const day = optional(
      rec,
      'scheduleDay',
      path,
      (v): v is DayName => typeof v === 'string' && Object.hasOwn(DAY_NAMES, v),
      'DayName',
      issues,
    )
    if (durationMin !== undefined) entry.durationMin = durationMin
    if (pace !== undefined) entry.averagePace = pace
    if (avgHr !== undefined) entry.averageHeartRate = avgHr
    if (maxHr !== undefined) entry.maxHeartRate = maxHr
    if (rpe !== undefined) entry.rpe = rpe
    if (notes !== undefined) entry.notes = notes
    if (day !== undefined) entry.scheduleDay = day
    out.push(entry)
  }
  return out
}

function validateBenchmark(raw: unknown, issues: Issues): BenchmarkResult | undefined {
  if (raw === undefined || raw === null) return undefined
  const path = 'state.benchmark'
  if (!isRecord(raw)) {
    issues.add(path, 'object', raw)
    return undefined
  }
  if (!isIsoDate(raw['date'])) {
    issues.add(`${path}.date`, 'YYYY-MM-DD', raw['date'])
    return undefined
  }
  if (!isFiniteNumber(raw['timeSec'])) {
    issues.add(`${path}.timeSec`, 'finite number', raw['timeSec'])
    return undefined
  }
  const createdAt = requireTimestamp(raw, 'createdAt', path, issues)
  if (!createdAt) return undefined

  const out: BenchmarkResult = { date: raw['date'], timeSec: raw['timeSec'], createdAt }
  const pace = optional(raw, 'averagePace', path, isName, 'string', issues)
  const avgHr = optional(raw, 'averageHeartRate', path, isFiniteNumber, 'finite number', issues)
  const maxHr = optional(raw, 'maxHeartRate', path, isFiniteNumber, 'finite number', issues)
  const notes = optionalNotes(raw, path, issues)
  if (pace !== undefined) out.averagePace = pace
  if (avgHr !== undefined) out.averageHeartRate = avgHr
  if (maxHr !== undefined) out.maxHeartRate = maxHr
  if (notes !== undefined) out.notes = notes
  return out
}

function validateActiveSession(raw: unknown, issues: Issues): ActiveSession | undefined {
  if (raw === undefined || raw === null) return undefined
  const path = 'state.activeSession'
  if (!isRecord(raw)) {
    issues.add(path, 'object', raw)
    return undefined
  }
  const before = issues.all.length
  const id = raw['id']
  const date = raw['date']
  const dayName = raw['dayName']
  const exerciseNames = raw['exerciseNames']
  const currentIndex = raw['currentIndex']
  const startedAt = requireTimestamp(raw, 'startedAt', path, issues)
  if (!isId(id)) issues.add(`${path}.id`, `non-empty string ≤ ${MAX_ID_CHARS} chars`, id)
  if (!isIsoDate(date)) issues.add(`${path}.date`, 'YYYY-MM-DD', date)
  if (typeof dayName !== 'string' || !Object.hasOwn(DAY_NAMES, dayName)) {
    issues.add(`${path}.dayName`, 'weekday name', dayName)
  }
  if (!Array.isArray(exerciseNames) || exerciseNames.length === 0 || exerciseNames.length > 200) {
    issues.add(`${path}.exerciseNames`, 'array(1..200)', exerciseNames)
  } else {
    exerciseNames.forEach((name, index) => {
      if (!isName(name)) issues.add(`${path}.exerciseNames[${index}]`, 'exercise name', name)
    })
  }
  if (
    !Number.isInteger(currentIndex) ||
    (currentIndex as number) < 0 ||
    (Array.isArray(exerciseNames) && (currentIndex as number) >= exerciseNames.length)
  ) {
    issues.add(`${path}.currentIndex`, 'valid exercise index', currentIndex)
  }
  if (issues.all.length !== before || !startedAt) return undefined
  return {
    id: id as string,
    date: date as IsoDate,
    dayName: dayName as DayName,
    exerciseNames: exerciseNames as string[],
    currentIndex: currentIndex as number,
    startedAt,
  }
}

function validateState(raw: unknown, issues: Issues): PersistedState {
  const empty: PersistedState = {
    settings: { programStartDate: toLocalISODate() },
    checklist: {},
    checkIns: {},
    strengthLog: [],
    runLog: [],
    benchmark: undefined,
    activeSession: undefined,
    _schemaVersion: SCHEMA_VERSION,
  }
  if (!isRecord(raw)) {
    issues.add('state', 'object', raw)
    return empty
  }
  const rawSettings = raw['settings']
  let programStartDate = empty.settings.programStartDate
  if (!isRecord(rawSettings)) {
    issues.add('state.settings', 'object', rawSettings)
  } else if (!isIsoDate(rawSettings['programStartDate'])) {
    // parseLocalISODate does .split('-').map(Number) — a bad string yields
    // new Date(NaN,…) and the Weekly screen renders undefined.
    issues.add('state.settings.programStartDate', 'YYYY-MM-DD', rawSettings['programStartDate'])
  } else {
    programStartDate = rawSettings['programStartDate']
  }

  return {
    settings: { programStartDate },
    checklist: validateChecklist(raw['checklist'], issues),
    checkIns: validateCheckIns(raw['checkIns'], issues),
    strengthLog: validateStrengthLog(raw['strengthLog'], issues),
    runLog: validateRunLog(raw['runLog'], issues),
    benchmark: validateBenchmark(raw['benchmark'], issues),
    activeSession: validateActiveSession(raw['activeSession'], issues),
    _schemaVersion: SCHEMA_VERSION,
  }
}

/**
 * Photo entries are validated strictly and *before* anything is written: a
 * malformed, oversized or duplicated entry rejects the whole file rather than
 * being silently dropped, so an import can never quietly lose a photo the user
 * believes they restored.
 */
function validatePhotos(raw: unknown, issues: Issues): BackupPhoto[] {
  const out: BackupPhoto[] = []
  if (raw === undefined) return out
  if (!Array.isArray(raw)) {
    issues.add('photos', 'array', raw)
    return out
  }
  if (raw.length > MAX_PHOTOS) {
    issues.add('photos', `≤ ${MAX_PHOTOS} photos`, `array(${raw.length})`)
    return out
  }
  const seen = new Set<string>()
  let total = 0
  for (const [i, rec] of raw.entries()) {
    const path = `photos[${i}]`
    if (!isRecord(rec)) {
      issues.add(path, 'object', rec)
      continue
    }
    if (!isPhotoKey(rec['key'])) {
      issues.add(`${path}.key`, 'photo:YYYY-MM-DD:front|side[#token]', rec['key'])
      continue
    }
    if (seen.has(rec['key'])) {
      issues.add(`${path}.key`, 'unique photo key', rec['key'])
      continue
    }
    if (!isSupportedPhotoMime(rec['mime'])) {
      issues.add(`${path}.mime`, 'image/jpeg | image/png | image/webp', rec['mime'])
      continue
    }
    const bytes = rec['bytes']
    if (!isFiniteNumber(bytes) || !Number.isInteger(bytes) || bytes <= 0) {
      issues.add(`${path}.bytes`, 'positive integer', bytes)
      continue
    }
    if (bytes > MAX_PHOTO_BYTES) {
      issues.add(`${path}.bytes`, `≤ ${MAX_PHOTO_BYTES} bytes`, bytes)
      continue
    }
    // Bound the declared total before looking at any payload, so a file claiming
    // 500 MB of photos is refused without inspecting them.
    total += bytes
    if (total > MAX_TOTAL_PHOTO_BYTES) {
      issues.add('photos', `≤ ${MAX_TOTAL_PHOTO_BYTES} total bytes`, `${total} bytes`)
      break
    }
    if (typeof rec['data'] !== 'string') {
      issues.add(`${path}.data`, 'base64 string', rec['data'])
      continue
    }
    // Length arithmetic, no allocation — a lying `bytes` must not get us to decode
    // the payload first.
    const declared = base64DecodedLength(rec['data'])
    if (declared === undefined) {
      issues.add(`${path}.data`, 'valid base64', `string(${rec['data'].length} chars)`)
      continue
    }
    if (declared !== bytes) {
      issues.add(`${path}.data`, `${bytes} decoded bytes`, `${declared} decoded bytes`)
      continue
    }
    seen.add(rec['key'])
    out.push({ key: rec['key'], mime: rec['mime'], bytes, data: rec['data'] })
  }
  return out
}

/** Validate a parsed backup document. Pure — touches no storage. */
export function validateBackup(raw: unknown): Result<BackupFile, ImportError> {
  if (!isRecord(raw)) {
    return { ok: false, error: { code: 'E_NOT_JSON', message: 'File is not a JSON object.' } }
  }
  if (raw['magic'] !== MAGIC) {
    return {
      ok: false,
      error: { code: 'E_BAD_MAGIC', message: "This file isn't a Cengo Cut backup." },
    }
  }

  const formatVersion = raw['formatVersion']
  if (formatVersion === FORMAT_VERSION) {
    // exact match — the only accepted case
  } else if (isFiniteNumber(formatVersion) && Number.isInteger(formatVersion) && formatVersion > FORMAT_VERSION) {
    return {
      ok: false,
      error: {
        code: 'E_FORMAT_NEWER',
        message: 'This backup was made by a newer version of the app. Update the app, then retry.',
      },
    }
  } else {
    // Old, negative, fractional, or not a number at all.
    return {
      ok: false,
      error: {
        code: 'E_FORMAT_UNSUPPORTED',
        message: `Unsupported backup format (expected version ${FORMAT_VERSION}).`,
        issues: [
          { path: 'formatVersion', expected: String(FORMAT_VERSION), got: describe(formatVersion) },
        ],
      },
    }
  }

  const schemaVersion = raw['schemaVersion']
  if (schemaVersion !== SCHEMA_VERSION) {
    return {
      ok: false,
      error: {
        code: 'E_SCHEMA_MISMATCH',
        message: `This backup isn't compatible with this version (data ${describe(schemaVersion)}).`,
      },
    }
  }

  const issues = new Issues()
  if (!isIsoTimestamp(raw['exportedAt'])) {
    issues.add('exportedAt', 'ISO timestamp (YYYY-MM-DDTHH:mm:ss.sssZ)', raw['exportedAt'])
  }
  const state = validateState(raw['state'], issues)
  const photos = validatePhotos(raw['photos'], issues)

  if (issues.failed) {
    return {
      ok: false,
      error: {
        code: 'E_INVALID',
        message: 'This backup is damaged.',
        issues: issues.all.slice(0, MAX_ISSUES_REPORTED),
      },
    }
  }

  // Counts are recomputed rather than trusted — the file cannot misreport itself.
  return {
    ok: true,
    value: {
      magic: MAGIC,
      formatVersion: FORMAT_VERSION,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: raw['exportedAt'] as string,
      counts: {
        checklist: Object.keys(state.checklist).length,
        checkIns: Object.keys(state.checkIns).length,
        strength: state.strengthLog.length,
        run: state.runLog.length,
        photos: photos.length,
      },
      state,
      photos,
    },
  }
}
