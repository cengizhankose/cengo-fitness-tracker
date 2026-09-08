import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { StateStorage } from 'zustand/middleware'
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'
import type { Activity } from '@/types/activities'

/** localStorage key holding the persist envelope `{ state, version }`. */
export const ACTIVITIES_STORAGE_KEY = 'cengo-activities'

/**
 * Garmin activities can carry per-second splits and HR-zone breakdowns for every run/ride/swim
 * — heavier than anything else this app persists. Keeping them in IndexedDB (like photos, via
 * idb-keyval) rather than the main store's single localStorage blob keeps that blob small and
 * keeps this slice's own quota independent of it. Same zustand `persist` shape either way.
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

export interface ActivitiesState {
  /** Keyed by Activity.id ("garmin-<garminId>") — this app only ever pulls these, so a plain
   *  upsert-by-id is a complete, correct merge (no local edits can ever conflict with it). */
  activities: Record<string, Activity>
  upsertMany: (incoming: Activity[]) => void
  resetAll: () => void
}

export const useActivitiesStore = create<ActivitiesState>()(
  persist(
    (set) => ({
      activities: {},
      upsertMany: (incoming) =>
        set((s) => {
          if (incoming.length === 0) return s
          const activities = { ...s.activities }
          for (const activity of incoming) activities[activity.id] = activity
          return { activities }
        }),
      resetAll: () => set({ activities: {} }),
    }),
    {
      name: ACTIVITIES_STORAGE_KEY,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({ activities: s.activities }),
    },
  ),
)
