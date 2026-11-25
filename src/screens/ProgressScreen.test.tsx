import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { WeighInSheet } from '@/components/progress/WeighInSheet'
import { useStore } from '@/store'
import { useActivitiesStore } from '@/store/activities'
import { useGarminDailyStore } from '@/store/garminDaily'
import { useToast } from '@/store/toast'
import type { CheckIn, IsoDate } from '@/types/userData'
import { ProgressScreen } from './ProgressScreen'

/** Friday of plan week 1. */
const TODAY = '2026-11-20'

function checkIn(date: IsoDate, weightKg: number, extra: Partial<CheckIn> = {}): CheckIn {
  return {
    date,
    weightKg,
    createdAt: `${date}T06:30:00.000Z`,
    updatedAt: `${date}T06:30:00.000Z`,
    ...extra,
  }
}

function seed(...records: CheckIn[]) {
  useStore.setState({ checkIns: Object.fromEntries(records.map((c) => [c.date, c])) })
}

function renderScreen() {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/progress']}>
      <ProgressScreen />
    </MemoryRouter>,
  )
  return user
}

const section = (heading: string) => screen.getByRole('heading', { name: heading }).closest('section')!

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 20, 9, 0))
  useActivitiesStore.setState({ activities: {} })
  useGarminDailyStore.setState({ days: {} })
  useToast.setState({ toasts: [] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ProgressScreen — saving weigh-ins', () => {
  it('saves a weigh-in for today from the primary action', async () => {
    seed(checkIn('2026-11-16', 95.5))
    const user = renderScreen()

    await user.click(screen.getByRole('button', { name: 'Tartı gir' }))
    const dialog = screen.getByRole('dialog')
    const weight = within(dialog).getByLabelText('Kilo')
    await user.clear(weight)
    await user.type(weight, '94,8')
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }))

    const { checkIns } = useStore.getState()
    expect(checkIns[TODAY]?.weightKg).toBe(94.8)
    expect(checkIns['2026-11-16']?.weightKg).toBe(95.5)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(useToast.getState().toasts.map((t) => t.tone)).toEqual(['success'])
  })

  it('saves a weigh-in for a past date', async () => {
    seed(checkIn('2026-11-16', 95.5))
    const user = renderScreen()

    await user.click(screen.getByRole('button', { name: 'Tartı gir' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Tarih'), { target: { value: '2026-11-17' } })
    const weight = within(dialog).getByLabelText('Kilo')
    await user.clear(weight)
    await user.type(weight, '95,2')
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }))

    const { checkIns } = useStore.getState()
    expect(checkIns['2026-11-17']?.weightKg).toBe(95.2)
    expect(checkIns[TODAY]).toBeUndefined()
  })

  it('edits an existing day in place, keeping one record and its other fields', async () => {
    seed(checkIn('2026-11-18', 95.1, { waistCm: 101, notes: 'sabah', frontPhotoKey: 'photo:2026-11-18:front' }))
    const user = renderScreen()

    await user.click(screen.getByRole('button', { name: /^Çar 18 Kas/ }))
    const dialog = screen.getByRole('dialog', { name: 'Tartıyı düzenle' })
    expect(within(dialog).getByLabelText('Kilo')).toHaveValue('95,1')
    expect(within(dialog).getByLabelText('Bel (opsiyonel)')).toHaveValue('101')
    expect(within(dialog).getByLabelText('Not (opsiyonel)')).toHaveValue('sabah')

    const weight = within(dialog).getByLabelText('Kilo')
    await user.clear(weight)
    await user.type(weight, '94,9')
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }))

    const { checkIns } = useStore.getState()
    expect(Object.keys(checkIns)).toEqual(['2026-11-18'])
    expect(checkIns['2026-11-18']).toMatchObject({
      weightKg: 94.9,
      waistCm: 101,
      notes: 'sabah',
      frontPhotoKey: 'photo:2026-11-18:front',
      createdAt: '2026-11-18T06:30:00.000Z',
    })
  })

  it('loads the saved values when the sheet date is moved onto an existing day', async () => {
    seed(checkIn('2026-11-16', 95.5), checkIn('2026-11-18', 95.1, { waistCm: 100 }))
    const user = renderScreen()

    await user.click(screen.getByRole('button', { name: 'Tartı gir' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Tarih'), { target: { value: '2026-11-16' } })
    expect(within(dialog).getByLabelText('Kilo')).toHaveValue('95,5')
    await user.click(within(dialog).getByRole('button', { name: 'Kaydet' }))

    expect(Object.keys(useStore.getState().checkIns).sort()).toEqual(['2026-11-16', '2026-11-18'])
  })
})

describe('ProgressScreen — weekly average and change', () => {
  it('averages each week and shows the change vs the previous week', () => {
    seed(checkIn('2026-11-10', 96.0), checkIn('2026-11-12', 95.6), checkIn('2026-11-18', 95.0))
    renderScreen()

    const stats = within(section('Tartı'))
    expect(stats.getByText('Bu hafta ort.').parentElement).toHaveTextContent('95kg1/3 sabah')
    expect(stats.getByText('Son tartı').parentElement).toHaveTextContent('Çar 18 Kas')
    // (96.0 + 95.6) / 2 = 95.8 → 95.0 this week
    expect(stats.getByText('−0,8')).toBeInTheDocument()
    expect(stats.getByText('düştü')).toBeInTheDocument()
  })

  it('has no change before a second week with weigh-ins', () => {
    seed(checkIn('2026-11-16', 95.5), checkIn('2026-11-18', 95.1))
    renderScreen()

    const stats = within(section('Tartı'))
    expect(stats.getByText('Bu hafta ort.').parentElement).toHaveTextContent('95,3kg2/3 sabah')
    expect(stats.getByText('Haftalık fark').parentElement).toHaveTextContent('—2 hafta gerekir')
  })
})

describe('ProgressScreen — strength chart', () => {
  it('with one week of data the header reads "bu hafta 1/5"', () => {
    useStore.setState({
      strengthLog: [
        {
          id: 'real-0',
          date: '2026-11-16',
          exerciseName: 'Incline Dumbbell Press',
          sets: [{ weightKg: 30, reps: 7, rpe: 8 }],
          createdAt: '2026-11-16T07:10:00.000Z',
        },
      ],
    })
    renderScreen()

    expect(section('Güç antrenmanı')).toHaveTextContent('bu hafta 1/5')
  })
})

describe('ProgressScreen — goal card', () => {
  it('asks for the first weigh-in when there is none', async () => {
    const user = renderScreen()

    const goal = within(section('Hedef'))
    expect(goal.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tartı gir' })).not.toBeInTheDocument()

    await user.click(goal.getByRole('button', { name: 'İlk tartını gir' }))
    const dialog = screen.getByRole('dialog', { name: 'Tartı gir' })
    expect(within(dialog).getByLabelText('Kilo')).toHaveValue('95,5')
  })

  it('shows distance lost and left without a verdict after one week of data', () => {
    seed(checkIn('2026-11-18', 94.0))
    renderScreen()

    const goal = within(section('Hedef'))
    expect(goal.getByText(/verdin/)).toHaveTextContent('1,5 kg verdin · 4 kg kaldı')
    expect(goal.getByRole('progressbar', { name: 'Yol' })).toHaveAttribute('aria-valuenow', '27')
    expect(goal.queryByText('Plandasın')).not.toBeInTheDocument()
    expect(goal.queryByText('Planın gerisinde')).not.toBeInTheDocument()
  })

  it('judges the pace once two weekly averages exist', () => {
    seed(checkIn('2026-11-12', 95.5), checkIn('2026-11-18', 95.0))
    renderScreen()

    expect(within(section('Hedef')).getByText('Plandasın')).toBeInTheDocument()
  })

  it('flags a gain against the plan', () => {
    seed(checkIn('2026-11-12', 95.5), checkIn('2026-11-18', 96.1))
    renderScreen()

    const goal = within(section('Hedef'))
    expect(goal.getByText(/aldın/)).toHaveTextContent('0,6 kg aldın · 6,1 kg kaldı')
    expect(goal.getByText('Planın gerisinde')).toBeInTheDocument()
  })

  it('marks the milestone as reached inside the band', () => {
    seed(checkIn('2026-11-18', 89.6))
    renderScreen()

    const goal = within(section('Hedef'))
    expect(goal.getByText('İlk hedef tamam')).toBeInTheDocument()
    expect(goal.getByText(/verdin/)).toHaveTextContent('5,9 kg verdin')
    expect(goal.queryByText(/kaldı/)).not.toBeInTheDocument()
    expect(goal.getByRole('progressbar', { name: 'Yol' })).toHaveAttribute('aria-valuenow', '100')
  })
})

describe('ProgressScreen — Toparlanma card', () => {
  it("shows the latest night's sleep from Garmin", () => {
    useGarminDailyStore.setState({
      days: {
        '2026-11-19': { date: '2026-11-19', sleepMin: 380, updatedAt: '2026-11-19T08:00:00.000Z' },
        '2026-11-20': {
          date: '2026-11-20',
          sleepMin: 432,
          sleepScore: 81,
          sleepStartLocal: '2026-11-19T23:48',
          sleepEndLocal: '2026-11-20T07:00',
          updatedAt: '2026-11-20T08:00:00.000Z',
        },
      },
    })
    renderScreen()

    const card = section('Toparlanma')
    expect(card).toHaveTextContent('7 sa 12 dk')
    expect(card).toHaveTextContent('skor 81 · 23:48–07:00')
    expect(card).not.toHaveTextContent('6 sa 20 dk')
  })

  it('is not rendered without Garmin data', () => {
    renderScreen()
    expect(screen.queryByRole('heading', { name: 'Toparlanma' })).not.toBeInTheDocument()
  })
})

describe('WeighInSheet', () => {
  it('prefills the weight with the latest weigh-in for a new day', () => {
    seed(checkIn('2026-11-16', 95.5, { waistCm: 102 }), checkIn('2026-11-18', 95.1))
    render(<WeighInSheet open onClose={() => {}} />)

    const dialog = screen.getByRole('dialog', { name: 'Tartı gir' })
    expect(within(dialog).getByLabelText('Tarih')).toHaveValue(TODAY)
    expect(within(dialog).getByLabelText('Kilo')).toHaveValue('95,1')
    expect(within(dialog).getByLabelText('Bel (opsiyonel)')).toHaveValue('')
  })

  it('steps the weight by 0.1 kg', async () => {
    const user = userEvent.setup()
    seed(checkIn('2026-11-18', 95.1))
    render(<WeighInSheet open onClose={() => {}} />)

    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Kilo azalt' }))
    expect(within(dialog).getByLabelText('Kilo')).toHaveValue('95')
  })
})
