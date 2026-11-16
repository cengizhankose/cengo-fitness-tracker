import type { StrengthLogEntry } from '@/types/userData'

/**
 * The production strength log as of 2026-11-16: eight single-set entries from the old Log
 * screen, no `sessionId`, legacy set shape (no `kind`/`id`), the old alias name for the lat
 * pulldown and Machine Chest Press logged as two separate entries.
 */
export function realStrengthLog(): StrengthLogEntry[] {
  const entry = (
    id: string,
    exerciseName: string,
    weightKg: number,
    reps: number,
    rpe: number,
    time: string,
  ): StrengthLogEntry => ({
    id,
    date: '2026-11-16',
    exerciseName,
    sets: [{ weightKg, reps, rpe }],
    createdAt: `2026-11-16T${time}:00.000Z`,
  })
  return [
    entry('r1', 'Incline Dumbbell Press', 30, 7, 8, '06:05'),
    entry('r2', 'Pull Up / Lat Pulldown', 60, 10, 9, '06:12'),
    entry('r3', 'Machine Chest Press', 40, 10, 7, '06:18'),
    entry('r4', 'Machine Chest Press', 40, 12, 7, '06:22'),
    entry('r5', 'Seated Cable Row', 50, 10, 9, '06:28'),
    entry('r6', 'Lateral Raise', 10, 20, 8, '06:34'),
    entry('r7', 'Cable Curl', 25, 12, 8, '06:40'),
    entry('r8', 'Rope Pushdown', 35, 12, 7, '06:46'),
  ]
}
