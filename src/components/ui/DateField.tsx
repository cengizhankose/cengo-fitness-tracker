import { useId } from 'react'
import type { ReactNode } from 'react'
import type { IsoDate } from '@/types/userData'
import { Field } from './Field'
import { INPUT_CLASS, fieldMessageId } from './fieldStyles'

export interface DateFieldProps {
  label: string
  /** 'YYYY-MM-DD' local date. */
  value: IsoDate
  onChange: (value: IsoDate) => void
  min?: IsoDate
  max?: IsoDate
  hint?: ReactNode
  error?: ReactNode
  disabled?: boolean
  id?: string
}

/** Labelled native date picker (local 'YYYY-MM-DD'); ignores the cleared state. */
export function DateField({ label, value, onChange, min, max, hint, error, disabled, id: idProp }: DateFieldProps) {
  const autoId = useId()
  const id = idProp ?? autoId
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value)
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={fieldMessageId(id, hint, error)}
        className={`${INPUT_CLASS} min-h-tap`}
      />
    </Field>
  )
}
