import { Dumbbell, Footprints, Trophy } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { BlockType } from '@/types/plan'

/** Accent color (CSS custom property) per plan block type. */
export const BLOCK_COLOR: Record<BlockType, string> = {
  strength: 'var(--color-volt)',
  run: 'var(--color-run)',
  football: 'var(--color-football)',
}

/** Turkish label per plan block type. */
export const BLOCK_LABEL: Record<BlockType, string> = {
  strength: 'Ağırlık',
  run: 'Koşu',
  football: 'Halısaha',
}

/** Icon per plan block type. */
export const BLOCK_ICON: Record<BlockType, LucideIcon> = {
  strength: Dumbbell,
  run: Footprints,
  football: Trophy,
}
