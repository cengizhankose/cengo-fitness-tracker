import { Sun } from 'lucide-react'
import { EmptyState, Screen } from '@/components/ui'

/** Bugün — placeholder until the screen is built on the UI kit. */
export function TodayScreen() {
  return (
    <Screen title="Bugün">
      <EmptyState icon={Sun} title="Hazırlanıyor" hint="Bu ekran yeniden tasarlanıyor." />
    </Screen>
  )
}
