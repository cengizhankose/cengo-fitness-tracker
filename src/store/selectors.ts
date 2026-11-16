import { useStore } from '@/store'
import type { IsoDate } from '@/types/userData'

// Raw slice hooks only — each returns a stable reference. Derived data is computed in the
// screens from the pure libs, never inside a selector (a fresh object per call would loop).
export const useSettings = () => useStore((s) => s.settings)
export const useChecklist = () => useStore((s) => s.checklist)
export const useChecklistRecord = (date: IsoDate) => useStore((s) => s.checklist[date])
export const useCheckIns = () => useStore((s) => s.checkIns)
export const useStrengthLog = () => useStore((s) => s.strengthLog)
export const useRunLog = () => useStore((s) => s.runLog)
export const useActiveSession = () => useStore((s) => s.activeSession)
