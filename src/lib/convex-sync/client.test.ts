import { describe, it, expect, vi, afterEach } from 'vitest'
import { SLICE_NAMES } from './types'

const query = vi.fn().mockResolvedValue([])
const mutation = vi.fn().mockResolvedValue(undefined)

vi.mock('convex/browser', () => ({
  ConvexHttpClient: vi.fn().mockImplementation(function (this: { query: typeof query; mutation: typeof mutation }) {
    this.query = query
    this.mutation = mutation
  }),
}))

const { createSyncClient, makeHttpSyncClient } = await import('./client')

afterEach(() => {
  vi.unstubAllEnvs()
  query.mockClear()
  mutation.mockClear()
})

describe('createSyncClient', () => {
  it('is disabled (undefined) when VITE_CONVEX_URL is missing, even with a secret set', () => {
    vi.stubEnv('VITE_CONVEX_URL', '')
    vi.stubEnv('VITE_SYNC_SECRET', 'a-secret')
    expect(createSyncClient()).toBeUndefined()
  })

  it('is disabled (undefined) when VITE_SYNC_SECRET is missing, even with a URL set', () => {
    vi.stubEnv('VITE_CONVEX_URL', 'http://127.0.0.1:3220')
    vi.stubEnv('VITE_SYNC_SECRET', '')
    expect(createSyncClient()).toBeUndefined()
  })

  it('returns a client when both the URL and secret are configured', () => {
    vi.stubEnv('VITE_CONVEX_URL', 'http://127.0.0.1:3220')
    vi.stubEnv('VITE_SYNC_SECRET', 'a-secret')
    expect(createSyncClient()).toBeDefined()
  })
})

describe('makeHttpSyncClient', () => {
  it('passes syncSecret on pull', async () => {
    const client = makeHttpSyncClient('http://127.0.0.1:3220', 'the-secret')
    await client.pull('checklist', '2026-08-03T00:00:00.000Z')
    expect(query).toHaveBeenCalledWith(expect.anything(), {
      updatedSince: '2026-08-03T00:00:00.000Z',
      syncSecret: 'the-secret',
    })
  })

  it('passes syncSecret on push', async () => {
    const client = makeHttpSyncClient('http://127.0.0.1:3220', 'the-secret')
    const records = [{ date: '2026-08-03' }]
    await client.push('checklist', records)
    expect(mutation).toHaveBeenCalledWith(expect.anything(), { records, syncSecret: 'the-secret' })
  })

  it('passes syncSecret on syncStateCursor', async () => {
    const client = makeHttpSyncClient('http://127.0.0.1:3220', 'the-secret')
    await client.syncStateCursor('checklist')
    expect(query).toHaveBeenCalledWith(expect.anything(), { slice: 'checklist', syncSecret: 'the-secret' })
  })

  it('routes pull and push for each of the four synced slices', async () => {
    const client = makeHttpSyncClient('http://127.0.0.1:3220', 'the-secret')
    expect(SLICE_NAMES).toEqual(['checklist', 'checkIns', 'strengthLog', 'runLog'])
    for (const slice of SLICE_NAMES) {
      await client.pull(slice, undefined)
      await client.push(slice, [])
    }
    expect(query).toHaveBeenCalledTimes(4)
    expect(mutation).toHaveBeenCalledTimes(4)
    for (const call of [...query.mock.calls, ...mutation.mock.calls]) expect(call[0]).toBeDefined()
  })

  it('propagates a rejection from the server (e.g. a wrong-secret Unauthorized throw)', async () => {
    query.mockRejectedValueOnce(new Error('Unauthorized'))
    const client = makeHttpSyncClient('http://127.0.0.1:3220', 'wrong-secret')
    await expect(client.pull('checklist', undefined)).rejects.toThrow('Unauthorized')
  })
})
