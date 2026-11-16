import { Utensils } from 'lucide-react'
import { EmptyState, Screen } from '@/components/ui'

/** Beslenme — placeholder until the screen is built on the UI kit. */
export function NutritionScreen() {
  return (
    <Screen title="Beslenme">
      <EmptyState icon={Utensils} title="Hazırlanıyor" hint="Bu ekran yeniden tasarlanıyor." />
    </Screen>
  )
}
