import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ActivitiesScreen } from '@/screens/ActivitiesScreen'
import { useActivitiesStore } from '@/store/activities'
import { checkA11y } from '@/test/axe'
import type { Activity } from '@/types/activities'

const TODAY = '2026-09-09'

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'garmin-1',
    garminId: 1,
    type: 'running',
    sportGroup: 'run',
    name: 'Morning Run',
    date: TODAY,
    startTimeLocal: `${TODAY}T07:00:00`,
    durationMin: 32,
    distanceKm: 6.4,
    avgHr: 150,
    maxHr: 171,
    calories: 410,
    createdAt: `${TODAY}T07:35:00.000Z`,
    updatedAt: `${TODAY}T07:35:00.000Z`,
    ...overrides,
  }
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/activities']}>
      <Routes>
        <Route path="/activities" element={<ActivitiesScreen />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ActivitiesScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(`${TODAY}T12:00:00`))
    useActivitiesStore.setState({ activities: {} })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the empty state when there are no activities', () => {
    renderScreen()
    expect(screen.getByText('No activities yet')).toBeInTheDocument()
  })

  it('renders a card for each activity, grouped under "Bugün"', () => {
    useActivitiesStore.setState({ activities: { 'garmin-1': makeActivity() } })
    renderScreen()

    expect(screen.getByRole('heading', { name: 'Bugün' })).toBeInTheDocument()
    expect(screen.getByText('Morning Run')).toBeInTheDocument()
    expect(screen.getByText(/6\.4 km/)).toBeInTheDocument()
    expect(screen.getByText(/32 min/)).toBeInTheDocument()
  })

  it('filter chips narrow the list down to the selected sport group', async () => {
    const user = userEvent.setup()
    useActivitiesStore.setState({
      activities: {
        'garmin-1': makeActivity({ id: 'garmin-1', name: 'Morning Run', sportGroup: 'run' }),
        'garmin-2': makeActivity({
          id: 'garmin-2',
          garminId: 2,
          name: 'Evening Swim',
          sportGroup: 'swim',
          type: 'lap_swimming',
        }),
      },
    })
    renderScreen()

    expect(screen.getByText('Morning Run')).toBeInTheDocument()
    expect(screen.getByText('Evening Swim')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Yüzme' }))

    expect(screen.queryByText('Morning Run')).not.toBeInTheDocument()
    expect(screen.getByText('Evening Swim')).toBeInTheDocument()
  })

  it('tapping a card opens its detail, showing the "Yorum bekliyor" placeholder when uncommented', async () => {
    const user = userEvent.setup()
    useActivitiesStore.setState({ activities: { 'garmin-1': makeActivity() } })
    renderScreen()

    expect(screen.queryByText('Yorum bekliyor')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Morning Run/ }))
    expect(screen.getByText('Yorum bekliyor')).toBeInTheDocument()
  })

  it('shows the comment and a "Plana Uygun" badge when the activity has both', async () => {
    const user = userEvent.setup()
    useActivitiesStore.setState({
      activities: {
        'garmin-1': makeActivity({ comment: 'Great tempo run', planAdherence: 'on_plan' }),
      },
    })
    renderScreen()

    await user.click(screen.getByRole('button', { name: /Morning Run/ }))
    expect(screen.getByText('Great tempo run')).toBeInTheDocument()
    expect(within(screen.getByRole('button', { name: /Morning Run/ })).getByText('Plana Uygun')).toBeInTheDocument()
  })

  it.each([
    ['substitution', 'İkame'],
    ['extra', 'Ek Antrenman'],
    ['unplanned', 'Plansız'],
  ] as const)('shows the %s badge as "%s"', (planAdherence, label) => {
    useActivitiesStore.setState({
      activities: { 'garmin-1': makeActivity({ planAdherence }) },
    })
    renderScreen()
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('is axe clean', async () => {
    useActivitiesStore.setState({ activities: { 'garmin-1': makeActivity() } })
    const { container } = renderScreen()
    expect(await checkA11y(container)).toHaveNoViolations()
  })
})
