import { useCallback, useEffect, useState } from 'react'
import { readSnapshot, readUndoSnapshot } from '@/lib/backup/import'
import type { RollbackSnapshot } from '@/lib/backup/import'

export interface RestorePoints {
  /** False until the first IndexedDB read resolves. */
  loaded: boolean
  /** Written before every import. */
  snapshot?: RollbackSnapshot
  /** Written before every manual rollback, so the rollback can be undone. */
  undo?: RollbackSnapshot
  /** Re-read both, e.g. after a failed apply that may have written a new point. */
  reload: () => Promise<void>
}

export function useRestorePoints(): RestorePoints {
  const [points, setPoints] = useState<Omit<RestorePoints, 'reload'>>({ loaded: false })

  const reload = useCallback(async () => {
    const [snapshot, undo] = await Promise.all([readSnapshot(), readUndoSnapshot()])
    setPoints({ loaded: true, snapshot, undo })
  }, [])

  useEffect(() => {
    let active = true
    void Promise.all([readSnapshot(), readUndoSnapshot()]).then(([snapshot, undo]) => {
      if (active) setPoints({ loaded: true, snapshot, undo })
    })
    return () => {
      active = false
    }
  }, [])

  return { ...points, reload }
}
