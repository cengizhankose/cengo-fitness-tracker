import { History } from 'lucide-react'
import { EmptyState, Screen } from '@/components/ui'

/** Geçmiş — placeholder until the screen is built on the UI kit. */
export function HistoryScreen() {
  return (
    <Screen title="Geçmiş">
      <EmptyState icon={History} title="Hazırlanıyor" hint="Bu ekran yeniden tasarlanıyor." />
    </Screen>
  )
}
