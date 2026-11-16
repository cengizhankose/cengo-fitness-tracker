import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../convex/_generated/api'
import { getConvexUrl, getSyncSecret } from './client'
import { activityFromWire } from './adapters'
import { useActivitiesStore } from '@/store/activities'

/**
 * Narrow, mockable surface this module needs — deliberately separate from the main
 * SyncClient (client.ts): activities are pull-only (garmin-logan's push_to_convex.py writes
 * them directly), so there is no push/upsert method to erase-and-dispatch through.
 */
export interface ActivitiesClient {
  /** Every activity on the server. */
  pullAll(): Promise<Record<string, unknown>[]>
}

/** undefined when no backend is configured — same graceful-degradation contract as
 *  client.ts's createSyncClient. */
export function createActivitiesClient(): ActivitiesClient | undefined {
  const url = getConvexUrl()
  const syncSecret = getSyncSecret()
  if (!url || !syncSecret) return undefined
  const http = new ConvexHttpClient(url)
  return {
    async pullAll() {
      // No `updatedSince`: the server's pull returns the whole table.
      return http.query(api.activities.pull, { syncSecret })
    },
  }
}

/**
 * Best-effort startup pull for the activities slice, kept fully independent of pull.ts's
 * pullAll: activities never enter mergeState (there is nothing local to merge against).
 *
 * Always a full pull, never cursor-based: the coach `comment` is written onto an activity
 * after it was first pushed, and the server does not bump the activity's `updatedAt` when that
 * happens, so an `updatedAt` cursor would leave such an activity on the device without its
 * comment forever. The table is small (a few dozen rows), so re-reading it costs nothing.
 *
 * Each wire record goes through activityFromWire and is upserted by id — the pulled copy always
 * wins, since the client never writes an activity of its own. Every failure is swallowed — an
 * unreachable backend must never block the app.
 */
export async function pullActivities(client: ActivitiesClient | undefined): Promise<void> {
  if (!client) return

  let raw: Record<string, unknown>[]
  try {
    raw = await client.pullAll()
  } catch {
    return
  }
  useActivitiesStore.getState().upsertMany(raw.map(activityFromWire))
}
