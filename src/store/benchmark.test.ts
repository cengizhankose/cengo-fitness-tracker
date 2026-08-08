import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '@/store'
import { BENCHMARK_DISTANCE_KM } from '@/lib/benchmark'

const validInput = { date: '2026-08-08', timeSec: 1470, distanceKm: BENCHMARK_DISTANCE_KM }
function persisted() {
  const raw = localStorage.getItem('cengo-cut')
  return raw ? JSON.parse(raw).state : undefined
}
const snapshot = () => {
  const s = useStore.getState()
  return { benchmark: s.benchmark, runs: s.runLog.length }
}

describe('logBenchmarkRun', () => {
  beforeEach(() => {
    useStore.setState({ benchmark: undefined, runLog: [], strengthLog: [], checklist: {} })
    localStorage.clear()
  })
  afterEach(() => vi.restoreAllMocks())

  it('writes the benchmark and run entry in one transition', () => {
    const seen: ReturnType<typeof snapshot>[] = []
    const unsubscribe = useStore.subscribe(() => seen.push(snapshot()))
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    expect(useStore.getState().logBenchmarkRun(validInput)).toBe(true)
    unsubscribe()
    expect(seen).toHaveLength(1)
    expect(setItem.mock.calls.filter(([key]) => key === 'cengo-cut')).toHaveLength(1)
    expect(seen[0]?.benchmark?.timeSec).toBe(1470)
    expect(seen[0]?.runs).toBe(1)
  })

  it('links benchmark and run consistently', () => {
    useStore.getState().logBenchmarkRun(validInput)
    const { benchmark, runLog, checklist } = useStore.getState()
    expect(benchmark).toMatchObject({ date: '2026-08-08', timeSec: 1470, averagePace: '4:54/km' })
    expect(runLog[0]).toMatchObject({
      date: '2026-08-08',
      distanceKm: BENCHMARK_DISTANCE_KM,
      durationMin: 24.5,
      averagePace: '4:54/km',
    })
    expect(runLog[0]?.createdAt).toBe(benchmark?.createdAt)
    expect(checklist['2026-08-08']?.items.completedWorkout).toBe(true)
    expect(persisted().benchmark.timeSec).toBe(1470)
  })

  it('refuses invalid times without a transition', () => {
    for (const timeSec of [0, -60, NaN, 1470.5, 599, 5401]) {
      const seen: unknown[] = []
      const unsubscribe = useStore.subscribe(() => seen.push(null))
      expect(useStore.getState().logBenchmarkRun({ ...validInput, timeSec })).toBe(false)
      unsubscribe()
      expect(seen).toHaveLength(0)
      expect(useStore.getState().benchmark).toBeUndefined()
      expect(useStore.getState().runLog).toHaveLength(0)
    }
  })

  it('refuses any distance other than 5 km', () => {
    for (const distanceKm of [0, 4.99, 5.01, 8, 10, 42.195, NaN]) {
      expect(useStore.getState().logBenchmarkRun({ ...validInput, distanceKm })).toBe(false)
      expect(useStore.getState().benchmark).toBeUndefined()
      expect(useStore.getState().runLog).toHaveLength(0)
    }
  })

  it('does not clobber an existing benchmark with invalid input', () => {
    useStore.getState().logBenchmarkRun(validInput)
    expect(useStore.getState().logBenchmarkRun({ ...validInput, timeSec: 0 })).toBe(false)
    expect(useStore.getState().benchmark?.timeSec).toBe(1470)
    expect(useStore.getState().runLog).toHaveLength(1)
  })

  it('overwrites benchmark and appends a run when logged again', () => {
    useStore.getState().logBenchmarkRun(validInput)
    expect(useStore.getState().logBenchmarkRun({ ...validInput, timeSec: 1380 })).toBe(true)
    expect(useStore.getState().benchmark?.timeSec).toBe(1380)
    expect(useStore.getState().runLog).toHaveLength(2)
  })
})
