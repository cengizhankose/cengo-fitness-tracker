import { Card, ListRow } from '@/components/ui'
import { plan } from '@/lib/plan'
import { formatLongDate } from '@/lib/dates'
import { SCHEMA_VERSION } from '@/store'
import { FORMAT_VERSION } from '@/lib/backup/format'

/** Plan identity and the data versions a backup is checked against. */
export function AboutCard() {
  return (
    <Card title="Hakkında" flush>
      <ListRow title="Plan" trailing={<span className="num">{`${plan.name} · v${plan.version}`}</span>} />
      <ListRow title="Plan başlangıcı" trailing={<span className="num">{formatLongDate(plan.startDate)}</span>} />
      <ListRow title="Veri sürümü" trailing={<span className="num">{`v${SCHEMA_VERSION}`}</span>} />
      <ListRow title="Yedek biçimi" trailing={<span className="num">{`v${FORMAT_VERSION}`}</span>} />
    </Card>
  )
}
