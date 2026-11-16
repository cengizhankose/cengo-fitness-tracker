import { Dumbbell } from 'lucide-react'
import { EmptyState, Screen } from '@/components/ui'

/** Antrenman — placeholder until the screen is built on the UI kit. */
export function SessionScreen() {
  return (
    <Screen title="Antrenman">
      <EmptyState icon={Dumbbell} title="Hazırlanıyor" hint="Bu ekran yeniden tasarlanıyor." />
    </Screen>
  )
}
