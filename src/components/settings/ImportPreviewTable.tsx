import { cx } from '@/components/ui/cx'
import type { SliceChange } from './slicePreview'

export interface ImportPreviewTableProps {
  slices: SliceChange[]
  /** Show the removed column (replace mode, or whenever something is removed). */
  showRemoved: boolean
}

type Column = 'added' | 'updated' | 'removed' | 'conflicts'

const COLUMN_LABEL: Record<Column, string> = {
  added: 'Yeni',
  updated: 'Değişen',
  removed: 'Silinen',
  conflicts: 'Çakışma',
}

const COLUMN_TONE: Record<Column, string> = {
  added: 'text-success',
  updated: 'text-warning',
  removed: 'text-danger',
  conflicts: 'text-text',
}

/** What the import would do, per data slice, with a total row. */
export function ImportPreviewTable({ slices, showRemoved }: ImportPreviewTableProps) {
  const columns: Column[] = ['added', 'updated']
  if (showRemoved) columns.push('removed')
  if (slices.some((s) => s.conflicts > 0)) columns.push('conflicts')

  const cell = (col: Column, n: number) => (
    <td key={col} className={cx('num py-2 pl-2 text-right text-base', n > 0 ? COLUMN_TONE[col] : 'text-text-faint')}>
      {col === 'added' && n > 0 ? `+${n}` : n}
    </td>
  )

  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Yedekten gelecek değişiklikler</caption>
      <thead>
        <tr className="border-b border-border text-xs text-text-muted">
          <th scope="col" className="py-2 text-left font-medium">
            Kayıt
          </th>
          {columns.map((col) => (
            <th key={col} scope="col" className="py-2 pl-2 text-right font-medium">
              {COLUMN_LABEL[col]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {slices.map((s) => (
          <tr key={s.key}>
            <th scope="row" className="py-2 text-left font-normal text-text">
              {s.label}
            </th>
            {columns.map((col) => cell(col, s[col]))}
          </tr>
        ))}
        <tr className="border-t border-border-strong">
          <th scope="row" className="py-2 text-left font-semibold text-text">
            Toplam
          </th>
          {columns.map((col) => cell(col, slices.reduce((sum, s) => sum + s[col], 0)))}
        </tr>
      </tbody>
    </table>
  )
}
