import { Dumbbell } from 'lucide-react'
import { EmptyState, Screen } from '@/components/ui'

/** Hareketler — placeholder until the screen is built on the UI kit. */
export function ExercisesScreen() {
  return (
    <Screen title="Hareketler">
      <EmptyState icon={Dumbbell} title="Hazırlanıyor" hint="Bu ekran yeniden tasarlanıyor." />
    </Screen>
  )
}
