import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { weekOverview } from '@/lib/week'
import { WeekStrip } from './WeekStrip'

const overview = weekOverview('2026-11-19', {
  strengthLog: [
    {
      id: 's1',
      date: '2026-11-16',
      exerciseName: 'Seated Cable Row',
      sets: [{ weightKg: 50, reps: 10, rpe: 9 }],
      createdAt: '2026-11-16T07:10:00.000Z',
    },
    {
      id: 's2',
      date: '2026-11-17',
      exerciseName: 'Bench Press',
      sets: [
        { id: 'w', weightKg: 50, reps: 5, kind: 'warmup' },
        { id: 'x', weightKg: 80, reps: 5, rpe: 9, kind: 'working' },
      ],
      sessionId: 'session-1',
      createdAt: '2026-11-17T07:10:00.000Z',
    },
    // Warmup only: Wednesday is not done.
    {
      id: 's3',
      date: '2026-11-18',
      exerciseName: 'Squat',
      sets: [{ id: 'w', weightKg: 60, reps: 5, kind: 'warmup' }],
      sessionId: 'session-2',
      createdAt: '2026-11-18T07:10:00.000Z',
    },
  ],
  runLog: [
    {
      id: 'r1',
      date: '2026-11-19',
      distanceKm: 4.5,
      durationMin: 25,
      createdAt: '2026-11-19T08:00:00.000Z',
    },
  ],
  activities: [],
  checklist: {},
})

describe('WeekStrip', () => {
  it('marks done strength and run blocks per day and today', () => {
    render(<WeekStrip overview={overview} today="2026-11-19" />)

    expect(screen.getByRole('listitem', { name: 'Pazartesi: Ağırlık yapıldı' })).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: 'Salı: Ağırlık yapıldı' })).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: 'Çarşamba: Ağırlık' })).toBeInTheDocument()

    const thursday = screen.getByRole('listitem', { name: 'Perşembe, bugün: Ağırlık, Koşu yapıldı' })
    expect(thursday).toHaveAttribute('aria-current', 'date')

    expect(
      screen.getByRole('listitem', { name: 'Cumartesi: Ağırlık opsiyonel, Koşu opsiyonel' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: 'Pazar: Koşu' })).not.toHaveAttribute('aria-current')
  })

  it('totals the week from the overview', () => {
    render(<WeekStrip overview={overview} today="2026-11-19" />)
    expect(screen.getByText('2/5 seans · 4,5 km')).toBeInTheDocument()
  })
})
