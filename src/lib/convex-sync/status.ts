import { create } from 'zustand'

export type SyncStatus = 'disabled' | 'connecting' | 'online' | 'offline'

interface SyncStatusState {
  status: SyncStatus
  /** Set on the most recent successful push or pull. */
  lastSyncedAt?: string
  /** Set on the most recent failure; cleared on the next success. */
  lastError?: string
  setConnecting: () => void
  setSynced: (at: string) => void
  setOffline: (message: string) => void
}

export const useSyncStatusStore = create<SyncStatusState>((set) => ({
  status: 'disabled',
  setConnecting: () => set({ status: 'connecting' }),
  setSynced: (lastSyncedAt) => set({ status: 'online', lastSyncedAt, lastError: undefined }),
  setOffline: (lastError) => set({ status: 'offline', lastError }),
}))
