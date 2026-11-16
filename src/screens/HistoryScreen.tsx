import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { History, Plus, SearchX } from 'lucide-react'
import { AddEntrySheet } from '@/components/history/AddEntrySheet'
import { EditExerciseDaySheet } from '@/components/history/EditExerciseDaySheet'
import { HistoryDayCard, dayAnchorId } from '@/components/history/HistoryDayCard'
import { formatMonthYear } from '@/components/history/format'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  FilterChips,
  IconButton,
  Screen,
  SectionTitle,
} from '@/components/ui'
import { formatActivityDistance } from '@/lib/activities'
import { formatShortDate } from '@/lib/dates'
import type { ExerciseDay } from '@/lib/exerciseStats'
import { TIMELINE_FILTER_LABEL, buildTimeline, filterTimeline } from '@/lib/timeline'
import type { TimelineDay, TimelineFilter } from '@/lib/timeline'
import { useStore } from '@/store'
import { useActivitiesStore } from '@/store/activities'
import { useCheckIns, useRunLog, useStrengthLog } from '@/store/selectors'
import { useToast } from '@/store/toast'
import type { IsoDate, RunLogEntry } from '@/types/userData'

/** Day cards rendered per "Daha fazla göster" step. */
const PAGE_DAYS = 30
const FILTERS: readonly TimelineFilter[] = ['all', 'strength', 'run', 'other']
const FILTER_LABEL: Record<TimelineFilter, string> = { ...TIMELINE_FILTER_LABEL, strength: 'Kuvvet' }
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

interface MonthGroup {
  key: string
  label: string
  days: TimelineDay[]
}

/**
 * Geçmiş — everything ever recorded, newest first: strength per exercise-day (editable),
 * Garmin activities, manual runs and weigh-ins. `?date=YYYY-MM-DD` scrolls to and marks a day.
 */
export function HistoryScreen() {
  const strengthLog = useStrengthLog()
  const runLog = useRunLog()
  const checkIns = useCheckIns()
  const activityMap = useActivitiesStore((s) => s.activities)
  const removeRunEntry = useStore((s) => s.removeRunEntry)
  const pushToast = useToast((s) => s.push)

  const [searchParams, setSearchParams] = useSearchParams()
  const dateParam = searchParams.get('date')
  const targetDate = dateParam && ISO_DATE.test(dateParam) ? dateParam : undefined

  const [filter, setFilter] = useState<TimelineFilter>('all')
  const [pages, setPages] = useState(1)
  const [editing, setEditing] = useState<ExerciseDay>()
  const [adding, setAdding] = useState(false)
  const [runToRemove, setRunToRemove] = useState<RunLogEntry>()
  const scrolledTo = useRef<string | undefined>(undefined)

  const timeline = useMemo(
    () =>
      buildTimeline({ strengthLog, runLog, activities: Object.values(activityMap), checkIns }),
    [strengthLog, runLog, activityMap, checkIns],
  )
  const chips = useMemo(
    () =>
      FILTERS.map((f) => ({
        value: f,
        label: FILTER_LABEL[f],
        count: filterTimeline(timeline, f).length,
      })),
    [timeline],
  )
  const days = useMemo(() => filterTimeline(timeline, filter), [timeline, filter])

  const targetIndex = targetDate ? days.findIndex((d) => d.date === targetDate) : -1
  const limit = Math.max(pages * PAGE_DAYS, Math.ceil((targetIndex + 1) / PAGE_DAYS) * PAGE_DAYS)
  const months = useMemo(() => {
    const groups: MonthGroup[] = []
    for (const day of days.slice(0, limit)) {
      const key = day.date.slice(0, 7)
      const current = groups[groups.length - 1]
      if (current?.key === key) current.days.push(day)
      else groups.push({ key, label: formatMonthYear(day.date), days: [day] })
    }
    return groups
  }, [days, limit])

  useEffect(() => {
    if (!targetDate || targetIndex < 0 || scrolledTo.current === targetDate) return
    const el = document.getElementById(dayAnchorId(targetDate))
    if (!el) return
    scrolledTo.current = targetDate
    el.scrollIntoView({ block: 'start' })
    el.focus({ preventScroll: true })
  }, [targetDate, targetIndex])

  function showDate(date: IsoDate) {
    setAdding(false)
    setFilter('all')
    scrolledTo.current = undefined
    setSearchParams({ date }, { replace: true })
  }

  function confirmRemoveRun() {
    if (!runToRemove) return
    removeRunEntry(runToRemove.id)
    setRunToRemove(undefined)
    pushToast('Silindi', 'success')
  }

  return (
    <Screen
      title="Geçmiş"
      action={
        <IconButton icon={Plus} variant="primary" aria-label="Kayıt ekle" onClick={() => setAdding(true)} />
      }
    >
      {timeline.length === 0 ? (
        <EmptyState
          icon={History}
          title="Henüz kayıt yok"
          hint="Geçmiş bir antrenmanı ya da koşuyu + ile ekle."
          action={
            <Button variant="secondary" icon={Plus} onClick={() => setAdding(true)}>
              Kayıt ekle
            </Button>
          }
        />
      ) : (
        <>
          <FilterChips
            label="Kayıt türü"
            options={chips}
            value={filter}
            onChange={(f) => {
              setFilter(f)
              setPages(1)
            }}
          />

          {days.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="Bu filtrede kayıt yok"
              hint="Başka bir filtre seç ya da + ile ekle."
              action={
                <Button variant="secondary" onClick={() => setFilter('all')}>
                  Tümünü göster
                </Button>
              }
            />
          ) : (
            months.map((month) => (
              <section key={month.key} aria-labelledby={`ay-${month.key}`} className="flex flex-col gap-3">
                <SectionTitle id={`ay-${month.key}`}>{month.label}</SectionTitle>
                {month.days.map((day) => (
                  <HistoryDayCard
                    key={day.date}
                    day={day}
                    highlighted={day.date === targetDate}
                    onEditExercise={setEditing}
                    onRemoveRun={setRunToRemove}
                  />
                ))}
              </section>
            ))
          )}

          {days.length > limit && (
            <Button variant="secondary" fullWidth onClick={() => setPages(Math.ceil(limit / PAGE_DAYS) + 1)}>
              Daha fazla göster
            </Button>
          )}
        </>
      )}

      {editing && (
        <EditExerciseDaySheet
          key={`${editing.date}:${editing.exerciseName}`}
          exerciseDay={editing}
          onClose={() => setEditing(undefined)}
        />
      )}
      {adding && <AddEntrySheet onClose={() => setAdding(false)} onSaved={showDate} />}
      <ConfirmDialog
        open={runToRemove != null}
        destructive
        title="Koşu silinsin mi?"
        message={
          runToRemove &&
          `${formatShortDate(runToRemove.date)} · ${formatActivityDistance(runToRemove.distanceKm)}`
        }
        confirmLabel="Sil"
        onConfirm={confirmRemoveRun}
        onCancel={() => setRunToRemove(undefined)}
      />
    </Screen>
  )
}
