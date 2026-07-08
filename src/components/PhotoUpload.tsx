import { useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
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

export function PhotoUpload({ label, date, slot, photoKey }: PhotoUploadProps) {
  const attachPhotoRef = useStore((s) => s.attachPhotoRef)
  const push = useToast((s) => s.push)
  const url = usePhotoUrl(photoKey)
  const [busy, setBusy] = useState(false)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      const key = await savePhoto(date, slot, file)
      attachPhotoRef(date, slot, key)
    } catch {
      push("Couldn't read that image")
    } finally {
      setBusy(false)
    }
  }

  return (
    <label className="flex cursor-pointer flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</span>
      <div className="relative grid aspect-[3/4] place-items-center overflow-hidden rounded-md border border-dashed border-border-strong bg-surface-2">
        {url ? (
          <img src={url} alt={label} className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-text-faint">
            <Camera size={24} />
            <span className="text-xs">Add photo</span>
          </span>
        )}
        {busy && (
          <span className="absolute inset-0 grid place-items-center bg-bg/60">
            <Loader2 size={22} className="animate-spin text-volt" />
          </span>
        )}
      </div>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFile}
        className="hidden"
      />
    </label>
  )
}
