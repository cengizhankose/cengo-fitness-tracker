import { useEffect, useState } from 'react'
import { getPhotoUrl } from '@/lib/photos'

/** Resolve an IndexedDB photo key to an object URL, revoking it on cleanup. */
export function usePhotoUrl(key?: string): string | undefined {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    let active = true
    let made: string | undefined
    const resolve = async () => {
      const u = key ? await getPhotoUrl(key) : undefined
      if (!active) {
        if (u) URL.revokeObjectURL(u)
        return
      }
      made = u
      setUrl(u)
    }
    void resolve()
    return () => {
      active = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [key])
  return url
}
