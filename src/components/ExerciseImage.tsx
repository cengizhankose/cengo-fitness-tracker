import { useState } from 'react'
import { EXERCISE_IMAGE } from '@/lib/exerciseImages'
import { ExerciseArt } from '@/lib/exerciseArt'

interface ExerciseImageProps {
  name: string
}

/** Real exercise photo when available; falls back to the schematic pose art. */
export function ExerciseImage({ name }: ExerciseImageProps) {
  const src = EXERCISE_IMAGE[name]
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <span className="grid h-full w-full place-items-center bg-surface-1">
        <ExerciseArt name={name} size={34} />
      </span>
    )
  }

  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-full w-full bg-white object-cover"
    />
  )
}
