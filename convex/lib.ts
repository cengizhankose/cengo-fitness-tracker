import { v } from 'convex/values'
import type { MutationCtx } from './_generated/server'

/** Spread into every public function's args object so the shape (and requirement) is
 *  identical everywhere — see auth.ts:requireSyncSecret for the check itself. */
export const syncSecretArg = { syncSecret: v.string() }

/** Bumps syncState[slice] to `updatedAt` if it's newer (or unset). Never moves it backward — an
 *  out-of-order batch push must not hide a newer write another client already recorded. */
export async function touchSyncState(
  ctx: MutationCtx,
  slice: string,
  updatedAt: string,
): Promise<void> {
  const existing = await ctx.db
    .query('syncState')
    .withIndex('by_slice', (q) => q.eq('slice', slice))
    .unique()
  if (!existing) {
    await ctx.db.insert('syncState', { slice, updatedAt })
    return
  }
  if (updatedAt > existing.updatedAt) {
    await ctx.db.patch(existing._id, { updatedAt })
  }
}
