import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { TodayScreen } from '@/screens/TodayScreen'
import { sessionById, sessionExercises } from '@/lib/plan'
import { useStore } from '@/store'
import { useActivitiesStore } from '@/store/activities'
import type { Activity } from '@/types/activities'
import type { StrengthLogEntry } from '@/types/userData'

const startSession = vi.hoisted(() => vi.fn())
vi.mock('@/components/session/useStartSession', () => ({ useStartSession: () => startSession }))

/** Pins "today" to a local calendar date (only Date is faked; timers stay real for user-event). */
function setToday(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(y!, m! - 1, d!, 8, 30))
}

function renderToday() {
  return render(
    <MemoryRouter>
      <TodayScreen />
    </MemoryRouter>,
  )
}

/** The 8 single-set entries logged on 2026-11-16 from the old Log screen (no sessionId). */
const REAL_2026_11_16: StrengthLogEntry[] = (
  [
    ['Incline Dumbbell Press', 30, 7, 8],
    ['Pull Up / Lat Pulldown', 60, 10, 9],
    ['Machine Chest Press', 40, 10, 7],
    ['Machine Chest Press', 40, 12, 7],
    ['Seated Cable Row', 50, 10, 9],
    ['Lateral Raise', 10, 20, 8],
    ['Cable Curl', 25, 12, 8],
    ['Rope Pushdown', 35, 12, 7],
  ] as const
).map(([exerciseName, weightKg, reps, rpe], i) => ({
  id: `real-${i}`,
  date: '2026-11-16',
  exerciseName,
  sets: [{ weightKg, reps, rpe }],
  createdAt: `2026-11-16T07:${String(10 + i * 3).padStart(2, '0')}:00.000Z`,
}))

const SARIYER_RUN: Activity = {
  id: 'garmin-25082708055',
  garminId: 25082708055,
  type: 'running',
  sportGroup: 'run',
  name: 'Sariyer Running',
  date: '2026-11-15',
  startTimeLocal: '2026-11-15 08:39:40',
  durationMin: 36,
  movingDurationMin: 35.9,
  distanceKm: 5.073,
  avgHr: 153,
  maxHr: 174,
  calories: 447,
  aerobicTE: 2.9,
  avgCadence: 146.6,
  comment: 'Maratondan 14 gün sonra ilk koşu: 36 dk / 5.1 km, ortalama nabız 153.',
  commentGeneratedAt: '2026-11-16T04:30:56.000Z',
  planAdherence: 'unplanned',
  planRef: '2026-11-15-sunday-post-race',
  createdAt: '2026-11-15T08:39:40',
  updatedAt: '2026-11-15T08:39:40',
}

beforeEach(() => {
  startSession.mockClear()
  useActivitiesStore.setState({ activities: {} })
})

describe('TodayScreen — plan of the day', () => {
  it('Tuesday suggests Push with Bench Press at 80 kg × 5 and starts it', async () => {
    setToday('2026-11-17')
    renderToday()

    expect(screen.getByRole('heading', { name: 'Push' })).toBeInTheDocument()
    const targets = screen.getByRole('list', { name: 'Bugünün hedefleri' })
    expect(within(targets).getByText('Bench Press').closest('li')).toHaveTextContent('80 kg × 5')
    expect(within(targets).getByText('Incline Dumbbell Press').closest('li')).toHaveTextContent(
      '30 kg × 8',
    )

    await userEvent.click(screen.getByRole('button', { name: 'Antrenmana başla' }))
    expect(startSession).toHaveBeenCalledWith('push')
  })

  it('Tuesday after the real Monday log targets the last working weight', () => {
    setToday('2026-11-17')
    useStore.setState({ strengthLog: REAL_2026_11_16 })
    renderToday()

    const targets = screen.getByRole('list', { name: 'Bugünün hedefleri' })
    // Last time 30 × 7 at RPE 8: target reps not reached, so the load holds.
    expect(within(targets).getByText('Incline Dumbbell Press').closest('li')).toHaveTextContent(
      '30 kg × 8',
    )
  })

  it('Sunday makes the group run (8 km in week 1) the main card without a start button', () => {
    setToday('2026-11-22')
    renderToday()

    const runCard = screen.getByRole('heading', { name: 'Grup koşusu' }).closest('section')!
    expect(runCard).toHaveTextContent('8 km')
    expect(runCard).toHaveTextContent("Nabız 155 altı; 162'yi geçerse yürü")
    expect(screen.queryByRole('button', { name: 'Antrenmana başla' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Antrenman ekle' })).toBeInTheDocument()
  })

  it('Thursday lists the easy run under the strength card', () => {
    setToday('2026-11-19')
    renderToday()

    expect(screen.getByRole('heading', { name: 'Üst vücut superset' })).toBeInTheDocument()
    expect(screen.getByText('Kolay koşu · 20 dk')).toBeInTheDocument()
  })

  it('Saturday offers both optional alternatives', async () => {
    setToday('2026-11-21')
    renderToday()

    expect(screen.getByRole('heading', { name: 'Seçmeli gün' })).toBeInTheDocument()
    expect(screen.getByText('Kolay koşu · 30 dk')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Antrenmana başla' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Üst vücut superset/ }))
    expect(startSession).toHaveBeenCalledWith('upper-superset')
  })
})

describe('TodayScreen — button states', () => {
  it('start: nothing running and nothing logged today', () => {
    setToday('2026-11-16')
    renderToday()

    expect(screen.getByRole('button', { name: 'Antrenmana başla' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Devam et' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Başka seans ekle' })).not.toBeInTheDocument()
  })

  it('resume: a running session shows "Devam et" with exercise progress', () => {
    setToday('2026-11-16')
    const pull = sessionById('pull')!
    const names = sessionExercises(pull).map((ex) => ex.name)
    useStore.setState({
      activeSession: {
        id: 'run-1',
        date: '2026-11-16',
        planSessionId: 'pull',
        exerciseNames: names,
        currentIndex: 1,
        startedAt: '2026-11-16T07:00:00.000Z',
      },
      strengthLog: [
        {
          id: 'e1',
          date: '2026-11-16',
          exerciseName: 'Deadlift',
          sessionId: 'run-1',
          sets: [
            { id: 's0', weightKg: 70, reps: 5, kind: 'warmup' },
            { id: 's1', weightKg: 120, reps: 5, rpe: 9, kind: 'working' },
          ],
          createdAt: '2026-11-16T07:05:00.000Z',
        },
      ],
    })
    renderToday()

    expect(screen.getByRole('link', { name: 'Devam et' })).toHaveAttribute('href', '/session')
    expect(screen.getByRole('progressbar', { name: 'Hareket' }).closest('section')).toHaveTextContent(
      `1/${names.length}`,
    )
    expect(screen.queryByRole('button', { name: 'Antrenmana başla' })).not.toBeInTheDocument()
  })

  it('done: strength logged today shows what was logged and "Başka seans ekle"', () => {
    setToday('2026-11-17')
    useStore.getState().addStrengthEntry({
      date: '2026-11-17',
      exerciseName: 'Bench Press',
      sets: [{ weightKg: 80, reps: 5, rpe: 9 }],
    })
    renderToday()

    expect(screen.queryByRole('button', { name: 'Antrenmana başla' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Başka seans ekle' })).toBeInTheDocument()
    const logged = screen.getByRole('list', { name: 'Bugün kaydedilenler' })
    expect(within(logged).getByRole('link', { name: /Bench Press/ })).toHaveTextContent(
      '80 kg × 5 · RPE 9',
    )
  })
})

describe('TodayScreen — daily ticks', () => {
  it('ticking protein writes the checklist of today', async () => {
    setToday('2026-11-17')
    renderToday()

    const protein = screen.getByRole('checkbox', { name: 'Protein tuttu' })
    expect(protein).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(protein)

    expect(useStore.getState().checklist['2026-11-17']?.items.hitProteinTarget).toBe(true)
    expect(protein).toHaveAttribute('aria-checked', 'true')
  })

  it('the workout tick reflects the auto-tick from logging and stays toggleable', async () => {
    setToday('2026-11-17')
    useStore.getState().addStrengthEntry({
      date: '2026-11-17',
      exerciseName: 'Bench Press',
      sets: [{ weightKg: 80, reps: 5, rpe: 8 }],
    })
    renderToday()

    const workout = screen.getByRole('checkbox', { name: /Antrenman yapıldı/ })
    expect(workout).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(workout)
    expect(useStore.getState().checklist['2026-11-17']?.items.completedWorkout).toBe(false)
  })
})

describe('TodayScreen — real 2026-11-16 data', () => {
  it('shows Pull as done with the 8 logged sets grouped by exercise, with RPE', () => {
    setToday('2026-11-16')
    useStore.setState({
      strengthLog: REAL_2026_11_16,
      checklist: {
        '2026-09-15': {
          date: '2026-09-15',
          items: { completedWorkout: true },
          autoWorkout: true,
          updatedAt: '2026-09-17T13:10:04.507Z',
        },
        '2026-11-16': {
          date: '2026-11-16',
          items: { completedWorkout: true },
          autoWorkout: true,
          updatedAt: '2026-11-16T07:40:00.000Z',
        },
      },
    })
    useActivitiesStore.setState({ activities: { [SARIYER_RUN.id]: SARIYER_RUN } })
    renderToday()

    const card = screen.getByRole('heading', { name: 'Pull' }).closest('section')!
    expect(within(card).getByText('Yapıldı')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Antrenmana başla' })).not.toBeInTheDocument()

    const logged = screen.getByRole('list', { name: 'Bugün kaydedilenler' })
    const rows = within(logged).getAllByRole('link')
    expect(rows.map((r) => r.getAttribute('href'))).toEqual(
      [
        'Incline Dumbbell Press',
        'Lat Pulldown',
        'Machine Chest Press',
        'Seated Cable Row',
        'Lateral Raise',
        'Cable Curl',
        'Rope Pushdown',
      ].map((n) => `/exercises/${encodeURIComponent(n)}`),
    )
    const setCount = rows.reduce((n, row) => n + within(row).getAllByRole('listitem').length, 0)
    expect(setCount).toBe(8)

    const chest = within(logged).getByRole('link', { name: /Machine Chest Press/ })
    expect(chest).toHaveTextContent('40 kg × 10 · RPE 7')
    expect(chest).toHaveTextContent('40 kg × 12 · RPE 7')
    expect(within(logged).getByRole('link', { name: /Lat Pulldown/ })).toHaveTextContent(
      '60 kg × 10 · RPE 9',
    )

    expect(screen.getByRole('checkbox', { name: /Antrenman yapıldı/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('link', { name: 'Geçmiş' })).toHaveAttribute('href', '/history')
  })
})
