import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../convex/_generated/api'
import { getConvexUrl, getSyncSecret } from './client'
import { useGarminDailyStore } from '@/store/garminDaily'
import type { GarminDaily } from '@/types/garminDaily'

/** Narrow, mockable surface this module needs. Pull-only, like activities: garmin-logan's
 *  sync_daily.py writes the rows, this app never pushes one back. */
export interface GarminDailyClient {
  /** Every day on the server, oldest first. */
  pullAll(): Promise<Record<string, unknown>[]>
}

/** undefined when no backend is configured — same graceful-degradation contract as
 *  client.ts's createSyncClient. */
export function createGarminDailyClient(): GarminDailyClient | undefined {
  const url = getConvexUrl()
  const syncSecret = getSyncSecret()
  if (!url || !syncSecret) return undefined
  const http = new ConvexHttpClient(url)
  return {
    async pullAll() {
      return http.query(api.garminDaily.pull, { syncSecret })
    },
  }
}

/**
 * Wire row → GarminDaily. Older rows written by the Python side may carry `null` for a value
 * Garmin did not have; every such key is dropped so the app only ever sees "absent". `date`
 * and `updatedAt` are never null, so stripping every null key is safe.
 */
export function garminDailyFromWire(wire: Record<string, unknown>): GarminDaily {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(wire)) {
    if (value !== null) out[key] = value
  }
  return out as unknown as GarminDaily
}

/**
 * Best-effort startup pull of the Garmin daily table. Always a full pull: the table is one row
 * per day, and a day's row is rewritten in place as Garmin finishes computing it (sleep score,
 * HRV status), so re-reading everything is the simplest correct merge. Rows are upserted by
 * date; every failure is swallowed — an unreachable backend must never block the app.
 */
export async function pullGarminDaily(client: GarminDailyClient | undefined): Promise<void> {
  if (!client) return

  let raw: Record<string, unknown>[]
  try {
    raw = await client.pullAll()
  } catch {
    return
  }
  useGarminDailyStore.getState().upsertMany(raw.map(garminDailyFromWire))
}
