import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { StateStorage } from 'zustand/middleware'
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'
import type { GarminDaily } from '@/types/garminDaily'
import type { IsoDate } from '@/types/userData'

/** IndexedDB key holding the persist envelope `{ state, version }`. */
export const GARMIN_DAILY_STORAGE_KEY = 'cengo-garmin-daily'

/**
 * One row per day for every day since the watch was first synced grows without bound, so like
 * the activities slice it lives in IndexedDB (idb-keyval) rather than the main store's single
 * localStorage blob.
 */
const idbStorage: StateStorage = {
  getItem: async (name) => (await idbGet<string>(name)) ?? null,
  setItem: async (name, value) => {
    await idbSet(name, value)
  },
  removeItem: async (name) => {
    await idbDel(name)
  },
}

export interface GarminDailyState {
  /** Keyed by GarminDaily.date. Pull-only: the server copy of a day always replaces the local one. */
  days: Record<IsoDate, GarminDaily>
  upsertMany: (incoming: GarminDaily[]) => void
  resetAll: () => void
}

/** Garmin wellness days (sleep, HRV, resting HR, steps, ...) pulled from Convex. */
export const useGarminDailyStore = create<GarminDailyState>()(
  persist(
    (set) => ({
      days: {},
      upsertMany: (incoming) =>
        set((s) => {
          if (incoming.length === 0) return s
          const days = { ...s.days }
          for (const day of incoming) days[day.date] = day
          return { days }
        }),
      resetAll: () => set({ days: {} }),
    }),
    {
      name: GARMIN_DAILY_STORAGE_KEY,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({ days: s.days }),
    },
  ),
)
