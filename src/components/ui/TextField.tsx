import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { Field } from './Field'
import { INPUT_CLASS, fieldMessageId } from './fieldStyles'
import { cx } from './cx'

export interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'size'> {
  label: string
  value: string
  onChange: (value: string) => void
  /** Default 'text'. */
  type?: 'text' | 'email' | 'url' | 'search' | 'tel' | 'time' | 'password'
  hint?: ReactNode
  error?: ReactNode
}

/** Labelled single-line text input with hint/error line. */
export function TextField({ label, value, onChange, type = 'text', hint, error, id: idProp, className, ...rest }: TextFieldProps) {
  const autoId = useId()
  const id = idProp ?? autoId
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={fieldMessageId(id, hint, error)}
        {...rest}
        className={cx(INPUT_CLASS, 'min-h-tap', className)}
      />
    </Field>
  )
}
