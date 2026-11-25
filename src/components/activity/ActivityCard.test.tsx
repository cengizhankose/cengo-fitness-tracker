import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Activity } from '@/types/activities'
import { ActivityCard } from './ActivityCard'

const RUN: Activity = {
  id: 'garmin-1',
  garminId: 1,
  type: 'running',
  sportGroup: 'run',
  name: 'Morning Run',
  date: '2026-11-20',
  startTimeLocal: '2026-11-20T07:00:00',
  durationMin: 30,
  distanceKm: 5,
  trainingLoad: 88.4,
  splits: [{ i: 1, distanceM: 1000, sec: 345, hr: 150 }],
  hrZones: [{ zone: 2, min: 12 }],
  createdAt: '2026-11-20T07:30:00.000Z',
  updatedAt: '2026-11-20T07:30:00.000Z',
}

describe('ActivityCard details', () => {
  it('shows laps, HR zones and training load on the full card', () => {
    render(<ActivityCard activity={RUN} />)
    const card = screen.getByRole('article')
    expect(card).toHaveTextContent('Antrenman yükü88')
    expect(card).toHaveTextContent('5:45/km')
    expect(screen.getByRole('progressbar', { name: 'Bölge 2' })).toBeInTheDocument()
  })

  it('keeps the compact card compact until the details are opened', async () => {
    const user = userEvent.setup()
    render(<ActivityCard activity={RUN} compact />)
    expect(screen.queryByText('Turlar')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'detaylar' }))
    expect(screen.getByText('Turlar')).toBeInTheDocument()
  })

  it('renders no detail block for an activity without synced detail', () => {
    const plain = { ...RUN, trainingLoad: undefined, splits: undefined, hrZones: undefined }
    render(<ActivityCard activity={plain} compact />)
    expect(screen.queryByRole('button', { name: 'detaylar' })).not.toBeInTheDocument()
  })
})
