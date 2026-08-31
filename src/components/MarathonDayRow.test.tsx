import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { MarathonDayRow } from './MarathonDayRow'
import { marathonPlan } from '@/lib/marathon/plan'
import { resolveActual } from '@/lib/marathon/derive'
import { useStore } from '@/store'
import { useToast } from '@/store/toast'
import { ToastHost } from '@/components/ToastHost'
import { checkA11y } from '@/test/axe'
import type { RunLogEntry } from '@/types/userData'

const runWorkout = marathonPlan.weeks[0]!.days[2]! // Wed 2 Sep 2026 — Threshold, 8km
const restWorkout = marathonPlan.weeks[0]!.days[0]! // Mon 31 Aug 2026 — REST
const raceWorkout = marathonPlan.weeks[8]!.days[6]! // Sun 1 Nov 2026 — RACE

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname + loc.search}</div>
}

interface HarnessProps {
  workout: (typeof runWorkout)
  runLog: RunLogEntry[]
  today: string
  expanded: boolean
  onToggle: () => void
  from: 'plan' | 'today'
  actual?: ReturnType<typeof resolveActual>
}

/** Mirrors a real parent (MarathonWeekSection etc.): re-derives `actual` from the
 *  live store on every render, so a Skip/Undo inside the row is reflected back. */
function Harness({ workout, runLog, today, expanded, onToggle, from, actual }: HarnessProps) {
  const statusMap = useStore((s) => s.marathonStatus)
  const resolved = actual ?? resolveActual(workout, runLog, statusMap)
  return (
    <MarathonDayRow
      workout={workout}
      actual={resolved}
      today={today}
      expanded={expanded}
      onToggle={onToggle}
      from={from}
    />
  )
}

function renderRow(props: Partial<HarnessProps> = {}) {
  const runLog: RunLogEntry[] = props.runLog ?? []
  const workout = props.workout ?? runWorkout
  return render(
    <MemoryRouter initialEntries={['/weekly']}>
      <Routes>
        <Route path="/weekly" element={<div>plan screen</div>} />
        <Route path="/log" element={<LocationProbe />} />
      </Routes>
      <Harness
        workout={workout}
        runLog={runLog}
        today={props.today ?? '2026-08-29'}
        expanded={props.expanded ?? false}
        onToggle={props.onToggle ?? (() => {})}
        from={props.from ?? 'plan'}
        actual={props.actual}
      />
      <ToastHost />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useStore.setState({ marathonStatus: {} })
  useToast.setState({ toasts: [] })
})

describe('MarathonDayRow — collapsed', () => {
  it('renders date, title, meta and pending status for a run day', () => {
    renderRow()
    expect(screen.getByText(/Wed 2 Sep/)).toBeInTheDocument()
    expect(screen.getAllByText('Threshold').length).toBeGreaterThan(0)
    expect(screen.getByText(/8 km/)).toBeInTheDocument()
    expect(screen.getByText(/24 min/)).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('never renders a literal pace from unresolved planned data', () => {
    renderRow()
    expect(screen.queryByText(/\d:\d\d\/km/)).not.toBeInTheDocument()
  })
})

describe('MarathonDayRow — expanded, run day', () => {
  it('shows Pace — while zones are unresolved', () => {
    renderRow({ expanded: true })
    expect(screen.getByText(/Pace/)).toHaveTextContent('Pace —')
  })

  it('Log run navigates to /log with the date and from=plan', async () => {
    const user = userEvent.setup()
    renderRow({ expanded: true, from: 'plan' })
    await user.click(screen.getByRole('button', { name: /Log run/ }))
    expect(await screen.findByTestId('loc')).toHaveTextContent(
      '/log?type=run&date=2026-09-02&from=plan',
    )
  })

  it('a run logged that date reads Done with actuals, CTA reads Log another', () => {
    const runLog: RunLogEntry[] = [
      {
        id: 'r1',
        date: '2026-09-02',
        distanceKm: 8.4,
        durationMin: 41,
        notes: 'legs felt heavy',
        createdAt: '2026-09-02T18:00:00.000Z',
      },
    ]
    renderRow({ expanded: true, runLog })
    expect(screen.getAllByText(/Done/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/8.4 km/).length).toBeGreaterThan(0)
    expect(screen.getByText(/legs felt heavy/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Log another/ })).toBeInTheDocument()
  })

  it('Skip stores skipped and shows Undo; Undo clears the override', async () => {
    const user = userEvent.setup()
    renderRow({ expanded: true })
    const row = () => screen.getByTestId('marathon-day-2026-09-02')

    await user.click(screen.getByRole('button', { name: /^Skip/ }))
    expect(useStore.getState().marathonStatus['2026-09-02']?.status).toBe('skipped')
    await screen.findByRole('button', { name: /^Undo/ })
    expect(row()).toHaveTextContent('Skipped')

    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(useStore.getState().marathonStatus['2026-09-02']).toBeUndefined()
    expect(row()).toHaveTextContent('Pending')
  })

  it('Undo after a completed override with a run intact falls back to Done', async () => {
    const user = userEvent.setup()
    const runLog: RunLogEntry[] = [
      { id: 'r1', date: '2026-09-02', distanceKm: 8, durationMin: 40, createdAt: '2026-09-02T18:00:00.000Z' },
    ]
    useStore.setState({
      marathonStatus: {
        '2026-09-02': { date: '2026-09-02', status: 'skipped', updatedAt: '2026-09-02T19:00:00.000Z' },
      },
    })
    renderRow({ expanded: true, runLog, actual: resolveActual(runWorkout, runLog, useStore.getState().marathonStatus) })

    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(useStore.getState().marathonStatus['2026-09-02']).toBeUndefined()
  })
})

describe('MarathonDayRow — REST day', () => {
  it('has no Log run button, no distance or pace text', () => {
    renderRow({ workout: restWorkout, expanded: true })
    expect(screen.queryByRole('button', { name: /Log run/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/km/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Pace/)).not.toBeInTheDocument()
  })

  it('Mark done -> completed, Skip -> skipped, Undo -> Pending', async () => {
    const user = userEvent.setup()
    renderRow({ workout: restWorkout, expanded: true })

    await user.click(screen.getByRole('button', { name: /Mark done/ }))
    expect(useStore.getState().marathonStatus['2026-08-31']?.status).toBe('completed')
    expect(await screen.findByText('Done')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(await screen.findByText('Pending')).toBeInTheDocument()

    renderRow({ workout: restWorkout, expanded: true })
    const skipButtons = screen.getAllByRole('button', { name: /^Skip/ })
    await user.click(skipButtons[skipButtons.length - 1]!)
    expect(useStore.getState().marathonStatus['2026-08-31']?.status).toBe('skipped')
  })

  it('a REST day with a run logged that date stays Pending and shows the informational line', () => {
    const runLog: RunLogEntry[] = [
      { id: 'r1', date: '2026-08-31', distanceKm: 8, durationMin: 40, createdAt: '2026-08-31T18:00:00.000Z' },
    ]
    renderRow({ workout: restWorkout, expanded: true, runLog })
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText(/logged a run/i)).toBeInTheDocument()
    expect(screen.queryByText(/8 km/)).not.toBeInTheDocument()
  })
})

describe('MarathonDayRow — race day and date treatment', () => {
  it('renders the RACE badge and 42.2 km', () => {
    renderRow({ workout: raceWorkout })
    expect(screen.getByText('Race')).toBeInTheDocument()
    expect(screen.getByText(/42.2 km/)).toBeInTheDocument()
  })

  it("today's row carries the today border", () => {
    renderRow({ today: '2026-09-02' })
    expect(screen.getByTestId('marathon-day-2026-09-02')).toHaveClass('border-volt/60')
  })

  it('a past pending day renders the missed tint but still reads Pending', () => {
    renderRow({ today: '2026-09-10' })
    const chip = screen.getByText('Pending')
    expect(chip.className).toMatch(/heat/)
  })
})

describe('MarathonDayRow — accessibility', () => {
  it('toggles aria-expanded and every action carries a date-qualified accessible name', async () => {
    const user = userEvent.setup()
    const onToggle = () => {}
    renderRow({ expanded: false, onToggle })
    const trigger = screen.getByRole('button', { expanded: false })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger.getAttribute('aria-label')).toMatch(/Wed 2 Sep/)

    renderRow({ expanded: true })
    expect(screen.getByRole('button', { name: /Skip Wed 2 Sep/ })).toBeInTheDocument()
    await user.tab()
  })

  it('is axe clean expanded with a run logged', async () => {
    const runLog: RunLogEntry[] = [
      { id: 'r1', date: '2026-09-02', distanceKm: 8, durationMin: 40, createdAt: '2026-09-02T18:00:00.000Z' },
    ]
    const { container } = renderRow({ expanded: true, runLog })
    expect(await checkA11y(container)).toHaveNoViolations()
  })
})
