import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { MarathonWeekSection } from './MarathonWeekSection'
import { marathonPlan } from '@/lib/marathon/plan'
import { useStore } from '@/store'
import type { RunLogEntry } from '@/types/userData'

const week1 = marathonPlan.weeks[0]!

function renderSection(props: Partial<React.ComponentProps<typeof MarathonWeekSection>> = {}) {
  return render(
    <MemoryRouter>
      <MarathonWeekSection
        week={props.week ?? week1}
        runLog={props.runLog ?? []}
        statusMap={props.statusMap ?? {}}
        today={props.today ?? '2026-08-29'}
        open={props.open ?? false}
        onOpenChange={props.onOpenChange ?? (() => {})}
        openDay={props.openDay ?? null}
        onDayToggle={props.onDayToggle ?? (() => {})}
      />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useStore.setState({ marathonStatus: {} })
})

describe('MarathonWeekSection — collapsed', () => {
  it('renders week number, date range, focus and totals in the summary trigger', () => {
    renderSection()
    const trigger = screen.getByRole('button', { expanded: false })
    expect(trigger).toHaveTextContent('Week 1')
    expect(trigger).toHaveTextContent('31 Aug')
    expect(trigger).toHaveTextContent('6 Sep')
    expect(trigger).toHaveTextContent('Base re-entry')
    expect(trigger).toHaveTextContent('39')
    expect(trigger).toHaveTextContent('0/5 sessions')
  })

  it('mounts no day rows while collapsed', () => {
    renderSection({ open: false })
    expect(screen.queryByText('Threshold')).not.toBeInTheDocument()
  })
})

describe('MarathonWeekSection — expanded', () => {
  it('renders exactly 7 rows, Monday-first, ascending dates', () => {
    renderSection({ open: true })
    const rows = week1.days.map((d) => screen.getByTestId(`marathon-day-${d.date}`))
    expect(rows).toHaveLength(7)
    const dates = rows.map((_, i) => week1.days[i]!.date)
    const sorted = [...dates].sort()
    expect(dates).toEqual(sorted)
    expect(rows[0]).toHaveTextContent(/Mon/)
  })

  it('a run logged mid-week shows up in the totals bar without duplicating day UI', () => {
    const runLog: RunLogEntry[] = [
      { id: 'r1', date: '2026-09-06', distanceKm: 16, durationMin: 96, createdAt: '2026-09-06T10:00:00.000Z' },
    ]
    renderSection({ open: true, runLog })
    const trigger = screen.getByRole('button', { expanded: true })
    expect(trigger).toHaveTextContent('16')
  })

  it('clicking a day row toggle calls onDayToggle with its date', async () => {
    const user = userEvent.setup()
    const calls: string[] = []
    renderSection({ open: true, onDayToggle: (d) => calls.push(d) })
    await user.click(screen.getByRole('button', { name: /Mon 31 Aug — Rest/ }))
    expect(calls).toEqual(['2026-08-31'])
  })
})
