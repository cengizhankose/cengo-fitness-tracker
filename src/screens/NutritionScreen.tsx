import { Badge, Card, Screen, SectionTitle, Stat, StatGrid } from '@/components/ui'
import { formatMinPlus, formatNumber, formatRange } from '@/lib/format'
import { plan } from '@/lib/plan'

/** Nutrition and supplements of the plan: daily targets, meals, eating out, supplements, sleep. */
export function NutritionScreen() {
  const { targets, meals, eatingOut } = plan.nutrition
  const { items: supplements, avoid } = plan.supplements

  return (
    <Screen title="Beslenme ve takviye" back="/plan">
      <Card title="Günlük hedef">
        <StatGrid cols={3}>
          <Stat label="Kalori" value={formatNumber(targets.caloriesKcal)} unit="kcal" />
          <Stat label="Protein" value={formatNumber(targets.proteinG)} unit="g" />
          <Stat label="Karbonhidrat" value={formatNumber(targets.carbsG)} unit="g" />
          <Stat label="Yağ" value={formatNumber(targets.fatG)} unit="g" />
          <Stat label="Su" value={`≈ ${formatNumber(targets.waterL)}`} unit="L" />
          <Stat label="Adım" value={formatMinPlus(targets.stepsMin)} />
        </StatGrid>
      </Card>

      <SectionTitle id="meals-title">Öğünler</SectionTitle>
      <Card flush>
        <ol aria-labelledby="meals-title" className="divide-y divide-border">
          {meals.map((meal) => (
            <li key={meal.id} className="flex flex-col gap-1.5 px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-base font-semibold">
                  {meal.title}
                  {meal.time && <span className="num ml-2 text-sm font-normal text-text-muted">{meal.time}</span>}
                </h3>
                <span className="num shrink-0 text-sm text-text-muted">
                  ≈ {formatRange(meal.approxKcal, 'kcal')}
                  {meal.proteinG != null && ` · ${formatNumber(meal.proteinG)} g protein`}
                </span>
              </div>
              <ul className="flex list-disc flex-col gap-0.5 pl-5 text-sm marker:text-text-faint">
                {meal.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Card>

      <Card title="Dışarıda yerken">
        <p className="text-sm">{eatingOut}</p>
      </Card>

      <SectionTitle id="supplements-title">Takviyeler</SectionTitle>
      <Card flush>
        <ul aria-labelledby="supplements-title" className="divide-y divide-border">
          {supplements.map((s) => (
            <li key={s.name} className="flex flex-col gap-1 px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="flex items-center gap-2 text-base font-semibold">
                  {s.name}
                  {s.optional && <Badge>Opsiyonel</Badge>}
                </h3>
                <span className="num shrink-0 text-sm font-semibold">{s.dose}</span>
              </div>
              {s.timing && <p className="text-sm text-text-muted">{s.timing}</p>}
              {s.note && <p className="text-sm text-text-faint">{s.note}</p>}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Kullanma">
        <ul className="flex flex-wrap gap-2">
          {avoid.map((item) => (
            <li key={item}>
              <Badge tone="danger">{item}</Badge>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Uyku">
        <p className="text-sm">{plan.sleepRule}</p>
      </Card>
    </Screen>
  )
}
