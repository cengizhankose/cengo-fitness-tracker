import { useRef } from 'react'
import type { ReactNode } from 'react'
import { Button } from './Button'
import { Sheet } from './Sheet'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  message?: ReactNode
  /** Default "Onayla". */
  confirmLabel?: string
  /** Default "Vazgeç". */
  cancelLabel?: string
  /** Red confirm button; focus starts on cancel. */
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Yes/no confirmation as a bottom sheet; `destructive` for deletes. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Onayla',
  cancelLabel = 'Vazgeç',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      title={title}
      initialFocus={destructive ? cancelRef : undefined}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button ref={cancelRef} variant="secondary" size="lg" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            size="lg"
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {message != null && <p className="text-base text-text-muted">{message}</p>}
    </Sheet>
  )
}
