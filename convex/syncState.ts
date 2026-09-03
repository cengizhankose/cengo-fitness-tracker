import { v } from 'convex/values'
import { query } from './_generated/server'
import { syncSecretArg } from './lib'
import { requireSyncSecret } from './auth'

/** The server's last-known updatedAt high-water mark for a slice, or undefined if it has
 *  never received a write. Bumped by each slice's upsertBatch mutation (see lib.ts). */
export const get = query({
  args: { slice: v.string(), ...syncSecretArg },
  handler: async (ctx, { slice, syncSecret }) => {
    requireSyncSecret(ctx, syncSecret)
    const doc = await ctx.db
      .query('syncState')
      .withIndex('by_slice', (q) => q.eq('slice', slice))
      .unique()
    return doc?.updatedAt
  },
})
