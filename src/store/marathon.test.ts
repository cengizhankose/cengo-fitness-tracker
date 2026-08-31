import { describe, expect, it } from 'vitest'
import { useStore, PERSISTED_KEYS, pickPersisted, STORAGE_KEY, SCHEMA_VERSION } from '@/store'

describe('marathonStatus store slice', () => {
  it('defaults to an empty object', () => {
    expect(useStore.getState().marathonStatus).toEqual({})
  })

  it('setMarathonStatus writes {date,status,updatedAt}', () => {
    useStore.getState().setMarathonStatus('2026-09-02', 'completed')
    const rec = useStore.getState().marathonStatus['2026-09-02']
    expect(rec?.date).toBe('2026-09-02')
    expect(rec?.status).toBe('completed')
    expect(rec?.updatedAt ?? '').toBeTruthy()
  })

  it('re-calling replaces the status and bumps updatedAt', () => {
    useStore.getState().setMarathonStatus('2026-09-02', 'completed')
    const first = useStore.getState().marathonStatus['2026-09-02']!.updatedAt
    useStore.getState().setMarathonStatus('2026-09-02', 'skipped')
    const rec = useStore.getState().marathonStatus['2026-09-02']
    expect(rec?.status).toBe('skipped')
    expect((rec?.updatedAt ?? '') >= first).toBe(true)
  })

  it('round-trips notes and drops them when empty', () => {
    useStore.getState().setMarathonStatus('2026-09-02', 'completed', 'legs felt heavy')
    expect(useStore.getState().marathonStatus['2026-09-02']?.notes).toBe('legs felt heavy')
    useStore.getState().setMarathonStatus('2026-09-02', 'completed', '')
    expect(useStore.getState().marathonStatus['2026-09-02']?.notes).toBeUndefined()
  })

  it('clearMarathonStatus removes the key; clearing an absent key is a no-op', () => {
    useStore.getState().setMarathonStatus('2026-09-02', 'completed')
    useStore.getState().clearMarathonStatus('2026-09-02')
    expect(useStore.getState().marathonStatus['2026-09-02']).toBeUndefined()
    expect(() => useStore.getState().clearMarathonStatus('2026-01-01')).not.toThrow()
  })

  it('does not touch checklist, runLog or strengthLog (D5)', () => {
    const before = {
      checklist: useStore.getState().checklist,
      runLog: useStore.getState().runLog,
      strengthLog: useStore.getState().strengthLog,
    }
    useStore.getState().setMarathonStatus('2026-09-02', 'completed')
    expect(useStore.getState().checklist).toBe(before.checklist)
    expect(useStore.getState().runLog).toBe(before.runLog)
    expect(useStore.getState().strengthLog).toBe(before.strengthLog)
  })

  it('resetAll clears marathonStatus', () => {
    useStore.getState().setMarathonStatus('2026-09-02', 'completed')
    useStore.getState().resetAll()
    expect(useStore.getState().marathonStatus).toEqual({})
  })

  it('PERSISTED_KEYS and pickPersisted include marathonStatus', () => {
    expect(PERSISTED_KEYS).toContain('marathonStatus')
    useStore.getState().setMarathonStatus('2026-09-02', 'completed')
    const persisted = pickPersisted(useStore.getState())
    expect(persisted.marathonStatus).toEqual(useStore.getState().marathonStatus)
  })

  it('rehydrates a v2 envelope lacking marathonStatus to {} (D4)', () => {
    const legacyEnvelope = {
      state: {
        settings: { programStartDate: '2026-08-03' },
        checklist: {},
        checkIns: {},
        strengthLog: [],
        runLog: [],
        benchmark: undefined,
        activeSession: undefined,
        _schemaVersion: 2,
        // no marathonStatus key at all
      },
      version: 2,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyEnvelope))
    useStore.persist.rehydrate()
    expect(useStore.getState().marathonStatus).toEqual({})
    expect(useStore.getState()._schemaVersion).toBe(SCHEMA_VERSION)
  })
})
