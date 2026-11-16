import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { PhotoUpload } from '@/components/PhotoUpload'
import { Card, DateField, Sparkline, formatDecimal } from '@/components/ui'
import { cx } from '@/components/ui/cx'
import { formatShortDate } from '@/lib/dates'
import { metricSeries } from '@/lib/weight'
import type { CheckIn, IsoDate } from '@/types/userData'

export interface BodyCardProps {
  checkIns: Readonly<Record<IsoDate, CheckIn>>
  today: IsoDate
}

/** Secondary, collapsed by default: front/side photos for a chosen day and the waist trend. */
export function BodyCard({ checkIns, today }: BodyCardProps) {
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState<IsoDate>(today)
  const waist = metricSeries(checkIns, 'waistCm')
  const lastWaist = waist.at(-1)
  const record = checkIns[date]

  return (
    <Card>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="-mx-4 -my-4 flex min-h-tap-lg w-[calc(100%+2rem)] items-center gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold">Fotoğraf ve bel</span>
          <span className="block truncate text-sm text-text-muted">
            {lastWaist
              ? `Bel ${formatDecimal(lastWaist.value, 1)} cm · ${formatShortDate(lastWaist.date)}`
              : 'Ön ve yan fotoğraf, bel ölçüsü'}
          </span>
        </span>
        <ChevronDown
          size={20}
          aria-hidden
          className={cx('shrink-0 text-text-muted transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div id={panelId} className="mt-6 flex flex-col gap-4">
          <DateField label="Fotoğraf tarihi" value={date} max={today} onChange={setDate} />
          <div className="grid grid-cols-2 gap-3">
            <PhotoUpload label="Ön" date={date} slot="front" photoKey={record?.frontPhotoKey} />
            <PhotoUpload label="Yan" date={date} slot="side" photoKey={record?.sidePhotoKey} />
          </div>
          {lastWaist && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-text-muted">Bel</span>
                <span className="num text-num">
                  {formatDecimal(lastWaist.value, 1)}
                  <span className="ml-1 text-sm font-medium text-text-muted">cm</span>
                </span>
              </div>
              <Sparkline
                values={waist.map((p) => p.value)}
                label={`Bel ${waist.length} ölçüm: ${formatDecimal(waist[0]!.value, 1)} → ${formatDecimal(lastWaist.value, 1)} cm`}
                width={140}
                height={40}
                tone="info"
              />
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
