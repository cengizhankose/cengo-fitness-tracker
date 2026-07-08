import { get, set, del, keys } from 'idb-keyval'
import type { IsoDate } from '@/types/userData'

export type PhotoSlot = 'front' | 'side'

export function photoKey(date: IsoDate, slot: PhotoSlot): string {
  return `photo:${date}:${slot}`
}

/** Downscale to a max edge + re-encode JPEG to keep IndexedDB light. */
async function downscaleImage(file: Blob, maxEdge = 1280, quality = 0.8): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    // Undecodable / unsupported source — store the original blob as-is.
    return file
  }
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    return file
  }
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  )
  return blob ?? file
}

/** Write a (downscaled) blob; returns the key to store on the CheckIn record. */
export async function savePhoto(date: IsoDate, slot: PhotoSlot, file: Blob): Promise<string> {
  const blob = await downscaleImage(file)
  const key = photoKey(date, slot)
  await set(key, blob)
  return key
}

/** Read a blob and return an object URL. Caller MUST revoke it when unmounted. */
export async function getPhotoUrl(key: string): Promise<string | undefined> {
  const blob = await get<Blob>(key)
  return blob ? URL.createObjectURL(blob) : undefined
}

export async function deletePhoto(key: string): Promise<void> {
  await del(key)
}

/** Photo keys present in IndexedDB but not referenced by any check-in. */
export async function orphanPhotoKeys(referenced: Set<string>): Promise<string[]> {
  const all = (await keys()) as string[]
  return all.filter((k) => typeof k === 'string' && k.startsWith('photo:') && !referenced.has(k))
}
