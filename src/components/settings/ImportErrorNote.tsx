import { AlertTriangle } from 'lucide-react'
import type { ImportError } from '@/lib/backup/format'
import { IMPORT_ERROR_TEXT } from './importText'

export interface ImportErrorNoteProps {
  error: ImportError
  /** False only when an apply failed AND its automatic rollback failed too. */
  dataIntact: boolean
}

/** Plain-Turkish failure box for reading, applying or rolling back a backup. */
export function ImportErrorNote({ error, dataIntact }: ImportErrorNoteProps) {
  return (
    <div role="alert" className="rounded-md border border-danger/40 bg-danger/10 p-3">
      <p className="flex items-start gap-2 text-sm font-semibold text-text">
        <AlertTriangle size={16} aria-hidden className="mt-0.5 shrink-0 text-danger" />
        {IMPORT_ERROR_TEXT[error.code]}
      </p>
      {error.issues && error.issues.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-text-muted">
          {error.issues.map((issue) => (
            <li key={issue.path}>
              Hatalı alan: <code className="text-text-faint">{issue.path}</code>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-sm text-text-muted">
        {dataIntact
          ? 'Hiçbir şey değişmedi.'
          : 'Geri dönüş de başarısız oldu; geri alınabilir noktayı kontrol et.'}
      </p>
    </div>
  )
}
