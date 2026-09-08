import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../convex/_generated/api'
import { getConvexUrl, getSyncSecret } from './client'
import { activityFromWire } from './adapters'
import { useActivitiesStore } from '@/store/activities'

const CURSOR_KEY = 'cengo-convex-sync-activities-cursor'

/** Highest `updatedAt` of any activity this device has successfully pulled so far. */
export function getActivitiesCursor(): string | undefined {
  try {
    return localStorage.getItem(CURSOR_KEY) ?? undefined
  } catch {
    return undefined
  }
}

export function setActivitiesCursor(updatedAt: string): void {
  try {
    localStorage.setItem(CURSOR_KEY, updatedAt)
  } catch {
    // best-effort only (e.g. quota exceeded) — must never break sync or the app
  }
}

/**
 * Narrow, mockable surface this module needs — deliberately separate from the main
 * SyncClient (client.ts): activities are pull-only (garmin-logan's push_to_convex.py writes
 * them directly), so there is no push/upsert method to erase-and-dispatch through.
 */
export interface ActivitiesClient {
  pull(updatedSince: string | undefined): Promise<Record<string, unknown>[]>
}

/** undefined when no backend is configured — same graceful-degradation contract as
 *  client.ts's createSyncClient. */
export function createActivitiesClient(): ActivitiesClient | undefined {
  const url = getConvexUrl()
  const syncSecret = getSyncSecret()
  if (!url || !syncSecret) return undefined
  const http = new ConvexHttpClient(url)
  return {
    async pull(updatedSince) {
      return http.query(api.activities.pull, { updatedSince, syncSecret })
    },
  }
}

/**
 * Best-effort startup pull for the activities slice, mirroring pull.ts's pullAll but kept
 * fully independent of it: activities never enter the checklist/checkIns/.../benchmark
 * merge system (mergeState has no notion of them, and never should — there is nothing local
 * to merge against). Pulls whatever changed since the local cursor, maps each wire record
 * through activityFromWire, and upserts by id (last-write-wins is trivially "the pulled copy
 * wins", since the client never writes an activity of its own). Every failure is swallowed —
 * an unreachable backend must never block the app.
 */
export async function pullActivities(client: ActivitiesClient | undefined): Promise<void> {
  if (!client) return

  const since = getActivitiesCursor()
  let raw: Record<string, unknown>[]
  try {
    raw = await client.pull(since)
  } catch {
    return
  }
  if (raw.length === 0) return

  const activities = raw.map(activityFromWire)
  useActivitiesStore.getState().upsertMany(activities)

  let latest = since
  for (const a of activities) {
    if (!latest || a.updatedAt > latest) latest = a.updatedAt
  }
  if (latest) setActivitiesCursor(latest)
}
