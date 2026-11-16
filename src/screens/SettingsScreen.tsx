import { Settings } from 'lucide-react'
import { EmptyState, Screen } from '@/components/ui'

/** Ayarlar — placeholder until the screen is built on the UI kit. */
export function SettingsScreen() {
  return (
    <Screen title="Ayarlar">
      <EmptyState icon={Settings} title="Hazırlanıyor" hint="Bu ekran yeniden tasarlanıyor." />
    </Screen>
  )
}
