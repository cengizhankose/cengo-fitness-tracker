import { ProgressBar } from '@/components/ui'
import { isRunActivity } from '@/lib/activities'
import { formatDuration, formatNumber, pace } from '@/lib/format'
import type { Activity } from '@/types/activities'
import { formatSplitDistance, groupStrengthSets } from './activityDetail'

/**
 * Everything Garmin synced for an activity beyond the summary row: training load, per-lap
 * splits, minutes per HR zone and strength sets. Each block renders only when its field exists.
 */
export function ActivityDetails({ activity, id }: { activity: Activity; id?: string }) {
  const { trainingLoad, splits, hrZones, strengthSets } = activity
  const isRun = isRunActivity(activity)
  const splitsHaveHr = splits?.some((s) => s.hr != null) ?? false
  const zoneMax = Math.max(0, ...(hrZones ?? []).map((z) => z.min))
  const strengthGroups = strengthSets ? groupStrengthSets(strengthSets) : []

  return (
    <div id={id} className="mt-4 flex flex-col gap-4">
      {trainingLoad != null && (
        <p className="flex items-baseline justify-between gap-3 text-sm">
          <span className="font-medium text-text-muted">Antrenman yükü</span>
          <span className="font-semibold tabular-nums">{formatNumber(trainingLoad, 0)}</span>
        </p>
      )}

      {splits && splits.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h4 className="text-sm font-semibold">Turlar</h4>
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-xs text-text-muted">
                <th scope="col" className="py-1 text-left font-medium">
                  Tur
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  Mesafe
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  {isRun ? 'Tempo' : 'Süre'}
                </th>
                {splitsHaveHr && (
                  <th scope="col" className="py-1 text-right font-medium">
                    Nabız
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {splits.map((split) => (
                <tr key={split.i}>
                  <td className="py-1.5 text-text-muted">{split.i}</td>
                  <td className="py-1.5 text-right">{formatSplitDistance(split.distanceM)}</td>
                  <td className="py-1.5 text-right font-semibold">
                    {isRun && split.distanceM > 0
                      ? pace(split.distanceM / 1000, split.sec / 60)
                      : formatDuration(split.sec)}
                  </td>
                  {splitsHaveHr && (
                    <td className="py-1.5 text-right">{split.hr != null ? Math.round(split.hr) : ''}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {hrZones && hrZones.length > 0 && (
        <section className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold">Nabız bölgeleri</h4>
          {hrZones.map((z) => (
            <ProgressBar
              key={z.zone}
              label={`Bölge ${z.zone}`}
              value={z.min}
              max={zoneMax}
              valueText={`${formatNumber(z.min, 0)} dk`}
              tone="run"
            />
          ))}
        </section>
      )}

      {strengthGroups.length > 0 && (
        <section className="flex flex-col gap-1">
          <h4 className="text-sm font-semibold">Setler</h4>
          <ul className="divide-y divide-border">
            {strengthGroups.map((group, index) => (
              <li key={index} className="py-1.5">
                {group.exercise && <p className="font-semibold">{group.exercise}</p>}
                <p className="text-sm tabular-nums">{group.sets.join(', ')}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
