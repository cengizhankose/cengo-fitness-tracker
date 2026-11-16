import { TrendingUp } from 'lucide-react'
import { EmptyState, Screen } from '@/components/ui'

/** İlerleme — placeholder until the screen is built on the UI kit. */
export function ProgressScreen() {
  return (
    <Screen title="İlerleme">
      <EmptyState icon={TrendingUp} title="Hazırlanıyor" hint="Bu ekran yeniden tasarlanıyor." />
    </Screen>
  )
}
