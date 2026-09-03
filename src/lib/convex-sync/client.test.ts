import { describe, it, expect, vi, afterEach } from 'vitest'

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

  it('propagates a rejection from the server (e.g. a wrong-secret Unauthorized throw)', async () => {
    query.mockRejectedValueOnce(new Error('Unauthorized'))
    const client = makeHttpSyncClient('http://127.0.0.1:3220', 'wrong-secret')
    await expect(client.pull('checklist', undefined)).rejects.toThrow('Unauthorized')
  })
})
