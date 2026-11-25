import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { HistoryScreen } from '@/screens/HistoryScreen'
import { dayAnchorId } from '@/components/history/format'
import { addDays } from '@/lib/dates'
import { useStore } from '@/store'
import { useActivitiesStore } from '@/store/activities'
import type { Activity } from '@/types/activities'
import type { CheckIn, DailyChecklistRecord, RunLogEntry, StrengthLogEntry } from '@/types/userData'

const TODAY = '2026-11-16'

function entry(id: string, exerciseName: string, weightKg: number, reps: number, rpe: number, time: string): StrengthLogEntry {
  return {
    id,
    date: TODAY,
    exerciseName,
    sets: [{ weightKg, reps, rpe }],
    createdAt: `${TODAY}T${time}:00.000Z`,
  }
}

/** Production strengthLog: 8 single-set ad-hoc entries, Machine Chest Press twice. */
const STRENGTH_LOG: StrengthLogEntry[] = [
  entry('s-rope', 'Rope Pushdown', 35, 12, 7, '08:10'),
  entry('s-curl', 'Cable Curl', 25, 12, 8, '08:05'),
  entry('s-lat-raise', 'Lateral Raise', 10, 20, 8, '08:00'),
  entry('s-row', 'Seated Cable Row', 50, 10, 9, '07:50'),
  entry('mcp-2', 'Machine Chest Press', 40, 12, 7, '07:40'),
  entry('mcp-1', 'Machine Chest Press', 40, 10, 7, '07:35'),
  entry('s-pulldown', 'Pull Up / Lat Pulldown', 60, 10, 9, '07:20'),
  entry('s-incline', 'Incline Dumbbell Press', 30, 7, 8, '07:10'),
]

/** Production runLog: two `garmin-` mirrors with a wrong averagePace, one manual run. */
const RUN_LOG: RunLogEntry[] = [
  {
    id: 'garmin-24513581874',
    date: '2026-09-27',
    distanceKm: 2.36,
    durationMin: 19.6,
    averagePace: '29:56',
    averageHeartRate: 142,
    maxHeartRate: 189,
    createdAt: '2026-09-27T11:16:44',
  },
  {
    id: '862cbbd6-4499-48f7-b903-d61a1b34913a',
    date: '2026-09-15',
    distanceKm: 6,
    rpe: 5,
    scheduleDay: 'Tuesday',
    createdAt: '2026-09-17T13:10:04.507Z',
  },
  {
    id: 'garmin-24207602358',
    date: '2026-09-02',
    distanceKm: 1.8,
    durationMin: 19.3,
    averagePace: '38:36',
    averageHeartRate: 177,
    maxHeartRate: 196,
    notes: '[treadmill] Garmin mesafesi tahmini — konsol degerini dogrula',
    createdAt: '2026-09-02T12:29:56',
  },
]

function activity(a: Partial<Activity> & Pick<Activity, 'id' | 'type' | 'sportGroup' | 'name' | 'date' | 'startTimeLocal' | 'durationMin'>): Activity {
  return {
    garminId: Number(a.id.replace(/\D/g, '')) || 0,
    comment: `${a.name} için koç yorumu.`,
    createdAt: `${a.date}T20:00:00.000Z`,
    updatedAt: `${a.date}T20:00:00.000Z`,
    ...a,
  }
}

const ACTIVITIES: Activity[] = [
  activity({ id: 'garmin-25082708055', type: 'running', sportGroup: 'run', name: 'Sariyer Running', date: '2026-11-15', startTimeLocal: '2026-11-15 08:39:40', durationMin: 36, movingDurationMin: 35.9, distanceKm: 5.073, avgHr: 153, maxHr: 174 }),
  activity({ id: 'garmin-25076485424', type: 'walking', sportGroup: 'other', name: 'Sisli Walking', date: '2026-11-14', startTimeLocal: '2026-11-14 12:50:07', durationMin: 187.2, movingDurationMin: 81.4, distanceKm: 8.195, avgHr: 95, maxHr: 144 }),
  activity({ id: 'garmin-24929464161', type: 'running', sportGroup: 'run', name: 'Üsküdar - Türkiye İş Bankası Istanbul Marathon', date: '2026-11-01', startTimeLocal: '2026-11-01 09:10:39', durationMin: 363.4, movingDurationMin: 358.9, distanceKm: 42.657, avgHr: 146, maxHr: 196 }),
  activity({ id: 'garmin-24513581874', type: 'running', sportGroup: 'run', name: 'Besiktas Running', date: '2026-09-27', startTimeLocal: '2026-09-27 11:16:44', durationMin: 19.6, movingDurationMin: 18.9, distanceKm: 2.356, avgHr: 142, maxHr: 189 }),
  activity({ id: 'garmin-24260599179', type: 'meditation', sportGroup: 'other', name: 'Meditation', date: '2026-09-06', startTimeLocal: '2026-09-06 17:19:27', durationMin: 7.3, avgHr: 120, maxHr: 132 }),
  activity({ id: 'garmin-24259060040', type: 'open_water_swimming', sportGroup: 'swim', name: 'Gökçeada Open Water Swimming', date: '2026-09-06', startTimeLocal: '2026-09-06 15:06:02', durationMin: 26.2, movingDurationMin: 18.2, distanceKm: 0.502, avgHr: 144, maxHr: 174 }),
  activity({ id: 'garmin-24207602358', type: 'treadmill_running', sportGroup: 'run', name: 'Base', date: '2026-09-02', startTimeLocal: '2026-09-02 12:29:56', durationMin: 19.3, movingDurationMin: 14.4, distanceKm: 1.799, avgHr: 177, maxHr: 196 }),
]

const CHECKLIST: Record<string, DailyChecklistRecord> = {
  [TODAY]: { date: TODAY, items: { hitProteinTarget: true }, updatedAt: `${TODAY}T09:00:00.000Z` },
}

const CHECK_INS: Record<string, CheckIn> = {
  [TODAY]: { date: TODAY, weightKg: 95.5, createdAt: `${TODAY}T06:30:00.000Z`, updatedAt: `${TODAY}T06:30:00.000Z` },
}

function seed(overrides: Partial<{ strengthLog: StrengthLogEntry[]; checkIns: Record<string, CheckIn> }> = {}) {
  useStore.setState({
    strengthLog: overrides.strengthLog ?? STRENGTH_LOG,
    runLog: RUN_LOG,
    checklist: CHECKLIST,
    checkIns: overrides.checkIns ?? CHECK_INS,
  })
  useActivitiesStore.setState({ activities: Object.fromEntries(ACTIVITIES.map((a) => [a.id, a])) })
}

function renderHistory(path = '/history') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/history" element={<HistoryScreen />} />
        <Route path="/exercises/:name" element={<p>detay</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

function dayCard(date: string): HTMLElement {
  const el = document.getElementById(dayAnchorId(date))
  if (!el) throw new Error(`no day card for ${date}`)
  return el
}

async function replaceNumber(user: UserEvent, input: HTMLElement, value: string) {
  await user.clear(input)
  await user.type(input, value)
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`))
  useActivitiesStore.setState({ activities: {} })
})

describe('HistoryScreen', () => {
  it('merges the two Machine Chest Press entries into one row with both sets', () => {
    seed()
    renderHistory()

    const links = screen.getAllByRole('link', { name: 'Machine Chest Press' })
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', '/exercises/Machine%20Chest%20Press')
    const row = links[0]!.closest('li')!
    expect(row).toHaveTextContent('40 kg × 10, 40 kg × 12 · RPE 7')
    // The alias is shown under its canonical name.
    expect(screen.getByRole('link', { name: 'Lat Pulldown' })).toBeInTheDocument()
    expect(within(dayCard(TODAY)).getByText(/Tartı/)).toHaveTextContent('Tartı 95,5 kg')
  })

  it("labels only the exercise done apart from its superset with Superset'ten ayrı yapıldı", () => {
    seed({
      strengthLog: STRENGTH_LOG.map((e) =>
        e.id === 's-curl'
          ? { ...e, splitFromSuperset: true }
          : e.id === 's-rope'
            ? { ...e, splitFromSuperset: false }
            : e,
      ),
    })
    renderHistory()

    const label = within(dayCard(TODAY)).getAllByText("Superset'ten ayrı yapıldı")
    expect(label).toHaveLength(1)
    expect(label[0]!.closest('li')).toBe(screen.getByRole('link', { name: 'Cable Curl' }).closest('li'))
  })

  it('editing the second Machine Chest Press set updates only its own entry', async () => {
    seed()
    const user = userEvent.setup()
    renderHistory()
    const before = useStore.getState().strengthLog
    const first = before.find((e) => e.id === 'mcp-1')

    await user.click(screen.getByRole('button', { name: 'Machine Chest Press düzenle' }))
    const dialog = screen.getByRole('dialog', { name: 'Machine Chest Press' })
    const set2 = within(dialog).getByRole('region', { name: 'Set 2' })
    await replaceNumber(user, within(set2).getByLabelText('Tekrar'), '11')
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }))

    const after = useStore.getState().strengthLog
    expect(after).toHaveLength(8)
    expect(after.find((e) => e.id === 'mcp-1')).toBe(first)
    const second = after.find((e) => e.id === 'mcp-2')!
    expect(second.date).toBe(TODAY)
    expect(second.sets).toHaveLength(1)
    expect(second.sets[0]).toMatchObject({ weightKg: 40, reps: 11, rpe: 7 })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Machine Chest Press' }).closest('li')).toHaveTextContent(
      '40 kg × 10, 40 kg × 11 · RPE 7',
    )
  })

  it('shows Garmin activities instead of their garmin- run mirrors', () => {
    seed()
    renderHistory()

    const treadmillDay = dayCard('2026-09-02')
    expect(within(treadmillDay).getByText('Base')).toBeInTheDocument()
    expect(within(treadmillDay).queryByRole('button', { name: 'Koşuyu sil' })).not.toBeInTheDocument()
    expect(within(dayCard('2026-09-27')).getByText('Besiktas Running')).toBeInTheDocument()
    expect(screen.queryByText(/38:36/)).not.toBeInTheDocument()
    expect(screen.queryByText(/29:56/)).not.toBeInTheDocument()

    // Only the real manual run is listed (and removable).
    const removeButtons = screen.getAllByRole('button', { name: 'Koşuyu sil' })
    expect(removeButtons).toHaveLength(1)
    expect(within(dayCard('2026-09-15')).getByText(/6 km · RPE 5/)).toBeInTheDocument()
  })

  it('formats the marathon and the long walk sensibly', () => {
    seed()
    renderHistory()

    const marathon = within(dayCard('2026-11-01')).getByText(/Istanbul Marathon$/).closest('article')!
    expect(marathon).toHaveTextContent('42,66 km')
    expect(marathon).toHaveTextContent('6 sa 3 dk')
    expect(marathon).toHaveTextContent('8:25/km')
    expect(marathon).toHaveTextContent('146 / 196')
    expect(marathon).toHaveTextContent('Marathon için koç yorumu.')

    const walk = within(dayCard('2026-11-14')).getByText('Sisli Walking').closest('article')!
    expect(walk).toHaveTextContent('3 sa 7 dk')
    expect(walk).not.toHaveTextContent('/km')
  })

  it('clamps a long coach comment behind "devamı" and keeps the stats visible', async () => {
    seed()
    const long = 'Uzun koç yorumu. '.repeat(20).trim()
    const marathonId = 'garmin-24929464161'
    const marathonActivity = ACTIVITIES.find((a) => a.id === marathonId)!
    useActivitiesStore.setState((s) => ({
      activities: { ...s.activities, [marathonId]: { ...marathonActivity, comment: long } },
    }))
    const user = userEvent.setup()
    renderHistory()

    const marathon = within(dayCard('2026-11-01')).getByText(/Istanbul Marathon$/).closest('article')!
    expect(within(marathon).getByText(long)).toHaveClass('line-clamp-3')
    expect(marathon).toHaveTextContent('42,66 km')
    expect(marathon).toHaveTextContent('6 sa 3 dk')

    const toggle = within(marathon).getByRole('button', { name: 'devamı' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle)
    expect(within(marathon).getByText(long)).not.toHaveClass('line-clamp-3')
    expect(within(marathon).getByRole('button', { name: 'kısalt' })).toHaveAttribute('aria-expanded', 'true')

    // Short comments are never clamped.
    const walk = within(dayCard('2026-11-14')).getByText('Sisli Walking').closest('article')!
    expect(within(walk).queryByRole('button', { name: 'devamı' })).not.toBeInTheDocument()
  })

  it('counts days per filter and narrows the feed', async () => {
    seed()
    const user = userEvent.setup()
    renderHistory()

    const chips = screen.getByRole('radiogroup', { name: 'Kayıt türü' })
    expect(within(chips).getByRole('radio', { name: /^Tümü\s*8$/ })).toBeChecked()
    expect(within(chips).getByRole('radio', { name: /^Kuvvet\s*1$/ })).toBeInTheDocument()
    expect(within(chips).getByRole('radio', { name: /^Koşu\s*5$/ })).toBeInTheDocument()
    expect(within(chips).getByRole('radio', { name: /^Diğer\s*2$/ })).toBeInTheDocument()

    await user.click(within(chips).getByRole('radio', { name: /^Diğer/ }))
    expect(screen.getByText('Sisli Walking')).toBeInTheDocument()
    expect(screen.getByText('Gökçeada Open Water Swimming')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Machine Chest Press' })).not.toBeInTheDocument()
    expect(screen.queryByText('Base')).not.toBeInTheDocument()
  })

  it('shows an empty state when a filter matches nothing', async () => {
    useActivitiesStore.setState({ activities: {} })
    useStore.setState({ strengthLog: STRENGTH_LOG })
    const user = userEvent.setup()
    renderHistory()

    await user.click(screen.getByRole('radio', { name: /^Koşu/ }))
    expect(screen.getByText('Bu filtrede kayıt yok')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tümünü göster' }))
    expect(screen.getByRole('link', { name: 'Machine Chest Press' })).toBeInTheDocument()
  })

  it('back-fills a past strength set onto its own day and ticks only that day', async () => {
    seed()
    const user = userEvent.setup()
    renderHistory()

    await user.click(screen.getByRole('button', { name: 'Kayıt ekle' }))
    const dialog = screen.getByRole('dialog', { name: 'Kayıt ekle' })
    fireEvent.change(within(dialog).getByLabelText('Tarih'), { target: { value: '2026-11-10' } })
    await user.type(within(dialog).getByLabelText('Hareket'), 'Bench')
    await user.click(within(dialog).getByRole('button', { name: 'Bench Press' }))
    const set1 = within(dialog).getByRole('region', { name: 'Set 1' })
    await replaceNumber(user, within(set1).getByLabelText('Ağırlık'), '80')
    await replaceNumber(user, within(set1).getByLabelText('Tekrar'), '5')
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }))

    const state = useStore.getState()
    expect(state.strengthLog).toHaveLength(9)
    const added = state.strengthLog.find((e) => e.exerciseName === 'Bench Press')!
    expect(added.date).toBe('2026-11-10')
    expect(added.sets).toHaveLength(1)
    expect(added.sets[0]).toMatchObject({ weightKg: 80, reps: 5 })
    expect(state.checklist['2026-11-10']?.items.completedWorkout).toBe(true)
    expect(state.checklist[TODAY]).toBe(CHECKLIST[TODAY])

    const day = dayCard('2026-11-10')
    expect(day).toHaveAttribute('aria-current', 'date')
    expect(within(day).getByRole('link', { name: 'Bench Press' }).closest('li')).toHaveTextContent('80 kg × 5')
  })

  it('deletes every entry of an exercise-day only after confirmation', async () => {
    seed()
    const user = userEvent.setup()
    renderHistory()

    await user.click(screen.getByRole('button', { name: 'Machine Chest Press düzenle' }))
    await user.click(screen.getByRole('button', { name: 'Bu günü sil' }))
    expect(useStore.getState().strengthLog).toHaveLength(8)

    const confirm = screen.getByRole('dialog', { name: 'Machine Chest Press silinsin mi?' })
    await user.click(within(confirm).getByRole('button', { name: 'Sil' }))

    const ids = useStore.getState().strengthLog.map((e) => e.id)
    expect(ids).toHaveLength(6)
    expect(ids).not.toContain('mcp-1')
    expect(ids).not.toContain('mcp-2')
    expect(screen.queryByRole('link', { name: 'Machine Chest Press' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Rope Pushdown' })).toBeInTheDocument()
  })

  it('?date= scrolls to and highlights the day', () => {
    seed()
    const scroll = vi.mocked(Element.prototype.scrollIntoView)
    scroll.mockClear()
    renderHistory('/history?date=2026-09-06')

    const day = dayCard('2026-09-06')
    expect(day).toHaveAttribute('aria-current', 'date')
    expect(dayCard(TODAY)).not.toHaveAttribute('aria-current')
    expect(scroll).toHaveBeenCalled()
    expect(scroll.mock.contexts.at(-1)).toBe(day)
  })

  it('renders 30 days at a time and expands the window for an older ?date=', async () => {
    const checkIns: Record<string, CheckIn> = {}
    for (let i = 0; i < 40; i++) {
      const date = addDays(TODAY, -i)
      checkIns[date] = { date, weightKg: 96 - i / 10, createdAt: `${date}T06:30:00.000Z`, updatedAt: `${date}T06:30:00.000Z` }
    }
    const oldest = addDays(TODAY, -39)
    useActivitiesStore.setState({ activities: {} })
    useStore.setState({ checkIns })
    const user = userEvent.setup()

    const { unmount } = renderHistory()
    expect(document.getElementById(dayAnchorId(addDays(TODAY, -29)))).toBeInTheDocument()
    expect(document.getElementById(dayAnchorId(addDays(TODAY, -30)))).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Daha fazla göster' }))
    expect(dayCard(oldest)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Daha fazla göster' })).not.toBeInTheDocument()
    unmount()

    renderHistory(`/history?date=${oldest}`)
    expect(dayCard(oldest)).toHaveAttribute('aria-current', 'date')
  })
})
