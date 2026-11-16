import { Dumbbell } from 'lucide-react'
import { EmptyState, Screen } from '@/components/ui'

/** Hareket — placeholder until the screen is built on the UI kit. */
export function ExerciseDetailScreen() {
  return (
    <Screen title="Hareket">
      <EmptyState icon={Dumbbell} title="Hazırlanıyor" hint="Bu ekran yeniden tasarlanıyor." />
    </Screen>
  )
}
