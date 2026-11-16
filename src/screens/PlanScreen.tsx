import { CalendarDays } from 'lucide-react'
import { EmptyState, Screen } from '@/components/ui'

/** Plan — placeholder until the screen is built on the UI kit. */
export function PlanScreen() {
  return (
    <Screen title="Plan">
      <EmptyState icon={CalendarDays} title="Hazırlanıyor" hint="Bu ekran yeniden tasarlanıyor." />
    </Screen>
  )
}
