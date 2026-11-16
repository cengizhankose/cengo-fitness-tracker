import { IMPORT_RESULT_KEY } from '@/lib/backup/format'

/**
 * Hand the summary to App's one-time toast and reload from `/`. A full reload, not a route
 * change: screen state seeded at mount and the object URLs held by `usePhotoUrl` are stale
 * after a restore. Separate module so tests can replace the navigation.
 */
export function finishRestore(summary: { added: number; updated: number }): void {
  sessionStorage.setItem(IMPORT_RESULT_KEY, JSON.stringify(summary))
  window.location.assign('/')
}
