import type { MutationCtx, QueryCtx } from './_generated/server'

/** Convex's isolate exposes env vars set via `npx convex env set` through `process.env`, but
 *  it isn't Node — no @types/node here, just the one surface actually used. */
declare const process: { env: Record<string, string | undefined> }

/** Constant-time compare over equal-length strings. Convex's runtime has no node:crypto, so
 *  this is a minimal timing-safe compare (XOR-accumulate over every char, no early exit). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Throws 'Unauthorized' unless `syncSecret` matches the deployment's SYNC_SECRET env var.
 * Every check funnels through the same throw so a caller can't distinguish "missing secret"
 * from "wrong secret" from "server misconfigured".
 *
 * Fails closed: a missing/empty SYNC_SECRET env var rejects every call, including a
 * correct-looking one. This means deploying these functions before running
 * `npx convex env set SYNC_SECRET <value>` bricks sync (all pulls/pushes throw) until the env
 * var is set on the deployment.
 */
export function requireSyncSecret(_ctx: QueryCtx | MutationCtx, syncSecret: string): void {
  const expected = process.env.SYNC_SECRET
  if (!expected || !syncSecret || !timingSafeEqual(syncSecret, expected)) {
    throw new Error('Unauthorized')
  }
}
