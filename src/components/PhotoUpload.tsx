import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { Camera, LoaderCircle } from 'lucide-react'
import { useStore } from '@/store'
import { useToast } from '@/store/toast'
import { savePhoto } from '@/lib/photos'
import type { PhotoSlot } from '@/lib/photos'
import { usePhotoUrl } from '@/lib/usePhotoUrl'
import type { IsoDate } from '@/types/userData'

interface PhotoUploadProps {
  label: string
  date: IsoDate
  slot: PhotoSlot
  photoKey?: string
}

/** Tap-to-capture progress photo tile for one check-in slot (front/side). */
export function PhotoUpload({ label, date, slot, photoKey }: PhotoUploadProps) {
  const attachPhotoRef = useStore((s) => s.attachPhotoRef)
  const push = useToast((s) => s.push)
  const url = usePhotoUrl(photoKey)
  const [busy, setBusy] = useState(false)

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      const key = await savePhoto(date, slot, file)
      attachPhotoRef(date, slot, key)
    } catch {
      push('Fotoğraf okunamadı', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <label className="flex cursor-pointer flex-col gap-1.5">
      <span className="text-sm font-medium text-text-muted">{label}</span>
      <span className="relative grid aspect-[3/4] place-items-center overflow-hidden rounded-md border border-dashed border-border-strong bg-raised focus-within:border-volt">
        {url ? (
          <img src={url} alt={label} className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-text-muted">
            <Camera size={24} aria-hidden />
            <span className="text-sm">Fotoğraf ekle</span>
          </span>
        )}
        {busy && (
          <span className="absolute inset-0 grid place-items-center bg-bg/60">
            <LoaderCircle size={22} aria-hidden className="animate-spin text-volt" />
          </span>
        )}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onFile}
          className="sr-only"
        />
      </span>
    </label>
  )
}
