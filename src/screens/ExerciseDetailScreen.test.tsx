import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { realStrengthLog } from '@/components/exercise/__fixtures__/realStrengthLog'
import { useStore } from '@/store'
import type { StrengthLogEntry } from '@/types/userData'
import { ExerciseDetailScreen } from './ExerciseDetailScreen'

function renderDetail(name: string) {
  const router = createMemoryRouter(
    [
      { path: '/exercises', element: <p>Liste</p> },
      { path: '/exercises/:name', element: <ExerciseDetailScreen /> },
      { path: '/history', element: <p>Zaman çizelgesi</p> },
    ],
    { initialEntries: [`/exercises/${encodeURIComponent(name)}`] },
  )
  return render(<RouterProvider router={router} />)
}

const card = (title: string) => {
  const heading = screen.getByRole('heading', { name: title })
  const section = heading.closest('section')
  if (!section) throw new Error(`no card for ${title}`)
  return within(section)
}

const historyDays = () => within(screen.getByRole('region', { name: /Geçmiş/ })).queryAllByRole('article')

describe('ExerciseDetailScreen', () => {
  beforeEach(() => {
    useStore.setState({ strengthLog: realStrengthLog() })
  })

  it('shows the plan target and the first-time hint for Bench Press without history', () => {
    renderDetail('Bench Press')
    expect(screen.getByRole('heading', { level: 1, name: 'Bench Press' })).toBeInTheDocument()
    const target = card('Sıradaki hedef')
    expect(target.getByText('1 × 5')).toBeInTheDocument()
    expect(target.getByText('80 kg')).toBeInTheDocument()
    expect(target.getByText(/^İlk kez/)).toHaveTextContent('İlk kez: 80 kg ile başla.')
    expect(card('Planda').getByText('Push · Salı')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Durum' })).toBeNull()
    expect(historyDays()).toHaveLength(0)
    expect(screen.getByText('Henüz kayıt yok')).toBeInTheDocument()
  })

  it('merges both Machine Chest Press entries into one day with every set, volume and timeline link', () => {
    renderDetail('Machine Chest Press')
    const days = historyDays()
    expect(days).toHaveLength(1)
    const day = within(days[0]!)
    const sets = day.getAllByRole('listitem').map((li) => li.textContent)
    expect(sets).toEqual(['140 kg × 10 · RPE 7', '240 kg × 12 · RPE 7'])
    expect(day.getByText('Hacim 880 kg')).toBeInTheDocument()
    expect(day.getByRole('link', { name: /Günü aç/ })).toHaveAttribute('href', '/history?date=2026-11-16')

    const status = card('Durum')
    expect(status.getByText('Son').parentElement).toHaveTextContent('40kg × 12')
    expect(status.getByText('Son efor (RPE)').parentElement).toHaveTextContent('7kolay')
    expect(status.getByText('Tahmini 1TM')).toBeInTheDocument()
    expect(status.getByText('yeni')).toBeInTheDocument()

    // A single training day is shown as plain numbers, not an empty chart.
    expect(screen.getByText('Grafik ikinci antrenman gününden sonra çıkar.')).toBeInTheDocument()
  })

  it('shows one target line per plan session for an exercise in two sessions', () => {
    renderDetail('Machine Chest Press')
    const target = card('Sıradaki hedef')
    const lines = target.getAllByRole('listitem').map((li) => li.textContent)
    expect(lines).toEqual(['Push1 × 1242,5 kg', 'Üst vücut superset2 × 1242,5 kg'])
    expect(target.getByText('Kolay geldi: +2,5 kg, 42,5 kg dene.')).toBeInTheDocument()
    const plan = card('Planda')
    expect(plan.getByText('Push · Salı')).toBeInTheDocument()
    expect(plan.getByText('Üst vücut superset · Perşembe, Cumartesi (isteğe bağlı)')).toBeInTheDocument()
  })

  it('holds the load when the target reps were missed', () => {
    renderDetail('Incline Dumbbell Press')
    const target = card('Sıradaki hedef')
    expect(target.getByText('1 × 8')).toBeInTheDocument()
    expect(target.getByText('30 kg')).toBeInTheDocument()
    expect(target.getByText(/^Aynı yükle devam/)).toBeInTheDocument()
  })

  it('resolves the "Pull Up / Lat Pulldown" alias to Lat Pulldown', () => {
    renderDetail('Pull Up / Lat Pulldown')
    expect(screen.getByRole('heading', { level: 1, name: 'Lat Pulldown' })).toBeInTheDocument()
    const days = historyDays()
    expect(days).toHaveLength(1)
    expect(days[0]).toHaveTextContent('60 kg × 10 · RPE 9')
  })

  it('gives a trend and the increase hint over two days when the last day was easy', () => {
    const nextDay: StrengthLogEntry = {
      id: 'n1',
      date: '2026-11-19',
      exerciseName: 'Lat Pulldown',
      sets: [
        { id: 'w1', weightKg: 35, reps: 10, kind: 'warmup' },
        { id: 'k1', weightKg: 62.5, reps: 10, rpe: 7, kind: 'working' },
      ],
      sessionId: 'session-2',
      createdAt: '2026-11-19T06:10:00.000Z',
    }
    useStore.setState({ strengthLog: [...realStrengthLog(), nextDay] })
    renderDetail('Lat Pulldown')

    const status = card('Durum')
    expect(status.getByText('arttı')).toBeInTheDocument()
    expect(status.getByText('önce 60 kg × 10 · RPE 9')).toBeInTheDocument()
    expect(status.getByText('Antrenman günü').parentElement).toHaveTextContent('2')

    const target = card('Sıradaki hedef')
    expect(target.getByText('2 × 10')).toBeInTheDocument()
    expect(target.getByText('65 kg')).toBeInTheDocument()
    expect(target.getByText('Kolay geldi: +2,5 kg, 65 kg dene.')).toBeInTheDocument()

    const days = historyDays()
    expect(days.map((d) => within(d).getByRole('heading').textContent)).toEqual(['Per 19 Kas', 'Pzt 16 Kas'])
    const newest = within(days[0]!)
    expect(newest.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '135 kg × 10ısınma',
      '262,5 kg × 10 · RPE 7',
    ])
    expect(newest.getByText('Hacim 625 kg')).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: 'Ağırlık' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Efor (RPE)' })).toBeInTheDocument()
  })

  it('shows an empty state for an unknown exercise', () => {
    renderDetail('Nope Press')
    expect(screen.getByText('Bu hareket yok')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Hareketlere dön' })).toHaveAttribute('href', '/exercises')
  })
})
