import { useId } from 'react'
import type { ReactNode, TextareaHTMLAttributes } from 'react'
import { Field } from './Field'
import { INPUT_CLASS, fieldMessageId } from './fieldStyles'
import { cx } from './cx'

export interface TextAreaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: ReactNode
  error?: ReactNode
}

/** Labelled multi-line text input (default 3 rows). */
export function TextArea({ label, value, onChange, hint, error, id: idProp, rows = 3, className, ...rest }: TextAreaProps) {
  const autoId = useId()
  const id = idProp ?? autoId
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={fieldMessageId(id, hint, error)}
        {...rest}
        className={cx(INPUT_CLASS, 'resize-none py-2.5', className)}
      />
    </Field>
  )
}
